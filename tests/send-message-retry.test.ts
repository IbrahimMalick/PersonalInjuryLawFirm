import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// runSendMessage (lib/pipeline.ts) — Pre-Launch Audit HIGH finding. It used
// to treat "failed" as an already-handled terminal state, the same as
// "sent": on retry it would see status !== "queued" and return immediately,
// no re-attempt, no throw — so the job queue's own retry/backoff never got
// a real second try. The first send attempt that failed became permanent,
// silently, with the job itself reporting success.

type Db = Awaited<ReturnType<typeof import("../lib/db").getDb>>;
let db: Db;
let tables: typeof import("../lib/db").tables;
let createFirm: typeof import("../lib/firm").createFirm;
let runSendMessage: typeof import("../lib/pipeline").runSendMessage;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-send-retry-"));

beforeAll(async () => {
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  const dbMod = await import("../lib/db");
  db = await dbMod.getDb();
  tables = dbMod.tables;
  ({ createFirm } = await import("../lib/firm"));
  ({ runSendMessage } = await import("../lib/pipeline"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function setupMessage(channel: string) {
  const firm = await createFirm(`Send Retry Firm ${crypto.randomUUID()}`, "", "personal_injury");
  const [user] = await db
    .insert(tables.users)
    .values({ firmId: firm.id, email: `u-${crypto.randomUUID()}@test.com`, name: "U", passwordHash: "x", role: "admin" })
    .returning();
  const [lead] = await db
    .insert(tables.leads)
    .values({ id: crypto.randomUUID(), firmId: firm.id, channel: "webform", fromAddress: "x@y.com", raw: "hi", status: "triaged" })
    .returning();
  const [message] = await db
    .insert(tables.messages)
    .values({ firmId: firm.id, leadId: lead.id, channel, toAddress: "x@y.com", body: "reply", approvedBy: user.id })
    .returning();
  return message;
}

describe("runSendMessage retry behaviour", () => {
  it("re-attempts a failed send on retry, rather than silently treating it as handled", async () => {
    // An unrecognized channel always hits sendViaChannel's failure branch —
    // a deterministic, always-fails outcome with no network/env mocking.
    const message = await setupMessage("bogus-channel");

    await expect(runSendMessage(message.id)).rejects.toThrow();
    const afterFirst = (await db.select().from(tables.messages).where(eq(tables.messages.id, message.id)))[0];
    expect(afterFirst.status).toBe("failed");

    // The bug: this used to return successfully (no throw) and leave status
    // "failed" forever, because the old guard treated "failed" as done.
    await expect(runSendMessage(message.id)).rejects.toThrow();
    const afterRetry = (await db.select().from(tables.messages).where(eq(tables.messages.id, message.id)))[0];
    expect(afterRetry.status).toBe("failed");
  });

  it("is idempotent once a message has actually gone out — no re-send attempt", async () => {
    // No email provider configured in this test env, so "webform" always
    // resolves to "simulated" — a genuine, non-failure terminal state.
    const message = await setupMessage("webform");

    await runSendMessage(message.id);
    const afterFirst = (await db.select().from(tables.messages).where(eq(tables.messages.id, message.id)))[0];
    expect(afterFirst.status).toBe("simulated");

    await expect(runSendMessage(message.id)).resolves.toBeUndefined();
    const afterRetry = (await db.select().from(tables.messages).where(eq(tables.messages.id, message.id)))[0];
    expect(afterRetry.status).toBe("simulated");
    expect(afterRetry.sentAt).toBe(afterFirst.sentAt); // untouched — no re-send happened
  });
});
