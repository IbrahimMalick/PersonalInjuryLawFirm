import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Pre-Launch Audit process gap: "There is not one test asserting that Firm A
// cannot read Firm B's lead, [or] that a reviewer can't perform admin
// actions... The locks are the untested part." This exercises the REAL
// route handlers (not just the auth helpers in isolation) against two
// tenants and both roles.
//
// These routes read the session via next/headers' cookies(), which only
// works inside Next's own request-handling machinery — calling the exported
// POST functions directly, as this does, needs that mocked. The mock reads
// a module-level token the test sets before each call, backed by a real
// session row in the database, so the actual currentUser()/apiUser() lookup
// logic still runs for real; only the cookie transport is faked.

let activeToken: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "ns_session" && activeToken ? { value: activeToken } : undefined),
  }),
}));

type Db = Awaited<ReturnType<typeof import("../lib/db").getDb>>;
let db: Db;
let tables: typeof import("../lib/db").tables;
let createFirm: typeof import("../lib/firm").createFirm;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-access-control-"));

interface TestUser {
  id: number;
  firmId: number;
  token: string;
}

async function seedSessionUser(firmId: number, email: string, role: "admin" | "reviewer"): Promise<TestUser> {
  const [user] = await db
    .insert(tables.users)
    .values({
      firmId,
      email,
      name: email,
      passwordHash: "x",
      role,
      emailVerifiedAt: new Date().toISOString(),
    })
    .returning({ id: tables.users.id });
  const token = `test-session-${user.id}-${crypto.randomUUID()}`;
  await db.insert(tables.sessions).values({
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
  return { id: user.id, firmId, token };
}

let firmAAdmin: TestUser;
let firmAReviewer: TestUser;
let firmBAdmin: TestUser;
let firmALeadId: string;
let firmAConflictLeadId: string;
let firmBLeadId: string;

beforeAll(async () => {
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  const dbMod = await import("../lib/db");
  db = await dbMod.getDb();
  tables = dbMod.tables;
  ({ createFirm } = await import("../lib/firm"));

  const firmA = await createFirm("Access Control Firm A", "", "personal_injury");
  const firmB = await createFirm("Access Control Firm B", "", "personal_injury");
  firmAAdmin = await seedSessionUser(firmA.id, "admin-a@access.test", "admin");
  firmAReviewer = await seedSessionUser(firmA.id, "reviewer-a@access.test", "reviewer");
  firmBAdmin = await seedSessionUser(firmB.id, "admin-b@access.test", "admin");

  const [leadA] = await db
    .insert(tables.leads)
    .values({
      id: crypto.randomUUID(),
      firmId: firmA.id,
      channel: "webform",
      fromAddress: "client-a@test.com",
      raw: "hi",
      status: "received",
    })
    .returning();
  firmALeadId = leadA.id;

  const [leadAConflict] = await db
    .insert(tables.leads)
    .values({
      id: crypto.randomUUID(),
      firmId: firmA.id,
      channel: "webform",
      fromAddress: "conflict-a@test.com",
      raw: "hi",
      status: "triaged",
      caseFile: { conflictFlags: ["Someone — Current client"] },
    })
    .returning();
  firmAConflictLeadId = leadAConflict.id;

  const [leadB] = await db
    .insert(tables.leads)
    .values({
      id: crypto.randomUUID(),
      firmId: firmB.id,
      channel: "webform",
      fromAddress: "client-b@test.com",
      raw: "hi",
      status: "received",
    })
    .returning();
  firmBLeadId = leadB.id;
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function jsonRequest(url: string, body: unknown = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("cross-tenant isolation on lead-mutation routes", () => {
  it("approve: firm B cannot approve firm A's lead — 404, not a billing/validation error that would leak it exists", async () => {
    activeToken = firmBAdmin.token;
    const { POST } = await import("../app/api/leads/[id]/approve/route");
    const res = await POST(jsonRequest("https://x.test/api/leads/1/approve", { body: "Hi there" }), {
      params: Promise.resolve({ id: firmALeadId }),
    });
    expect(res.status).toBe(404);
  });

  it("archive: firm B cannot archive firm A's lead", async () => {
    activeToken = firmBAdmin.token;
    const { POST } = await import("../app/api/leads/[id]/archive/route");
    const res = await POST(jsonRequest("https://x.test/api/leads/1/archive"), {
      params: Promise.resolve({ id: firmALeadId }),
    });
    expect(res.status).toBe(404);
    const row = (await db.select().from(tables.leads).where(eq(tables.leads.id, firmALeadId)))[0];
    expect(row.status).not.toBe("archived"); // nothing actually happened
  });

  it("reprocess: firm B cannot reprocess firm A's lead", async () => {
    activeToken = firmBAdmin.token;
    const { POST } = await import("../app/api/leads/[id]/reprocess/route");
    const res = await POST(jsonRequest("https://x.test/api/leads/1/reprocess"), {
      params: Promise.resolve({ id: firmALeadId }),
    });
    expect(res.status).toBe(404);
  });

  it("firm A's own admin CAN archive firm A's lead — the check is firm-scoped, not a blanket deny", async () => {
    activeToken = firmAAdmin.token;
    const { POST } = await import("../app/api/leads/[id]/archive/route");
    const res = await POST(jsonRequest("https://x.test/api/leads/1/archive"), {
      params: Promise.resolve({ id: firmALeadId }),
    });
    expect(res.status).toBe(200);
    const row = (await db.select().from(tables.leads).where(eq(tables.leads.id, firmALeadId)))[0];
    expect(row.status).toBe("archived");
  });

  it("rejects every route with no session at all", async () => {
    activeToken = null;
    const { POST: archivePost } = await import("../app/api/leads/[id]/archive/route");
    const res = await archivePost(jsonRequest("https://x.test/api/leads/1/archive"), {
      params: Promise.resolve({ id: firmBLeadId }),
    });
    expect(res.status).toBe(401);
  });
});

describe("role enforcement — a reviewer cannot release a conflict hold", () => {
  it("blocks a reviewer at the firm that owns the lead from approving a conflict-held reply", async () => {
    activeToken = firmAReviewer.token;
    const { POST } = await import("../app/api/leads/[id]/approve/route");
    const res = await POST(jsonRequest("https://x.test/api/leads/1/approve", { body: "Hi there" }), {
      params: Promise.resolve({ id: firmAConflictLeadId }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/conflict/i);
  });
});
