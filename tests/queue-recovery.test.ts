import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// recoverStuckJobs (lib/queue.ts) + onDead (lib/worker.ts) — a job killed
// mid-flight (a serverless timeout, not a clean throw) never reaches
// failJob's own dead-lettering; it just sits "running" until this function
// finds it. The bug this closes: reviving it to "pending" unconditionally
// meant a job killed on every attempt looped forever, burning a model call
// each pass while the lead stayed stuck reading "Reading…" indefinitely —
// nothing ever marked the job dead or the lead needing attention.

type Db = Awaited<ReturnType<typeof import("../lib/db").getDb>>;
let db: Db;
let tables: typeof import("../lib/db").tables;
let createFirm: typeof import("../lib/firm").createFirm;
let recoverStuckJobs: typeof import("../lib/queue").recoverStuckJobs;
let onDead: typeof import("../lib/worker").onDead;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-queue-recovery-"));

beforeAll(async () => {
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  const dbMod = await import("../lib/db");
  db = await dbMod.getDb();
  tables = dbMod.tables;
  ({ createFirm } = await import("../lib/firm"));
  ({ recoverStuckJobs } = await import("../lib/queue"));
  ({ onDead } = await import("../lib/worker"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const STUCK_SINCE = new Date(Date.now() - 20 * 60_000).toISOString(); // 20 min ago

describe("recoverStuckJobs", () => {
  it("revives a stuck job that still has attempts left, to pending", async () => {
    const [job] = await db
      .insert(tables.jobs)
      .values({
        type: "process_lead",
        payload: { leadId: "whatever" },
        status: "running",
        startedAt: STUCK_SINCE,
        attempts: 1,
        maxAttempts: 4,
      })
      .returning();

    const dead = await recoverStuckJobs();
    expect(dead.map((d) => d.id)).not.toContain(job.id);

    const row = (await db.select().from(tables.jobs).where(eq(tables.jobs.id, job.id)))[0];
    expect(row.status).toBe("pending");
  });

  it("dead-letters a stuck job that has exhausted its attempts, instead of reviving it forever", async () => {
    const [job] = await db
      .insert(tables.jobs)
      .values({
        type: "process_lead",
        payload: { leadId: "whatever-2" },
        status: "running",
        startedAt: STUCK_SINCE,
        attempts: 4,
        maxAttempts: 4,
      })
      .returning();

    const dead = await recoverStuckJobs();
    expect(dead.map((d) => d.id)).toContain(job.id);

    const row = (await db.select().from(tables.jobs).where(eq(tables.jobs.id, job.id)))[0];
    expect(row.status).toBe("dead");
    expect(row.lastError).toMatch(/killed mid-flight/i);
  });

  it("leaves a recently-claimed running job alone — not stuck yet", async () => {
    const [job] = await db
      .insert(tables.jobs)
      .values({
        type: "process_lead",
        payload: { leadId: "whatever-3" },
        status: "running",
        startedAt: new Date().toISOString(),
        attempts: 1,
        maxAttempts: 4,
      })
      .returning();

    await recoverStuckJobs();
    const row = (await db.select().from(tables.jobs).where(eq(tables.jobs.id, job.id)))[0];
    expect(row.status).toBe("running");
  });
});

describe("onDead", () => {
  it("marks a dead-lettered process_lead job's lead as needs_attention", async () => {
    const firm = await createFirm("Stuck Jobs Firm", "", "personal_injury");
    const [lead] = await db
      .insert(tables.leads)
      .values({
        id: crypto.randomUUID(),
        firmId: firm.id,
        channel: "webform",
        fromAddress: "x@y.com",
        raw: "hi",
        status: "processing",
      })
      .returning();

    await onDead(
      { type: "process_lead", payload: { leadId: lead.id } } as never,
      new Error("Killed mid-flight (serverless timeout) on its last available attempt")
    );

    const row = (await db.select().from(tables.leads).where(eq(tables.leads.id, lead.id)))[0];
    expect(row.status).toBe("needs_attention");
    expect(row.processingError).toMatch(/killed mid-flight/i);
  });
});
