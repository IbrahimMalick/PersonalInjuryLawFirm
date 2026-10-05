import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// deleteFirmCascade (lib/firm.ts) — the one function in this codebase that's
// allowed to be genuinely destructive. No FK cascades exist anywhere in this
// schema, so every firm-owned table has to be remembered by hand here; this
// test's real job is proving that list is complete and nothing of the
// deleted firm survives, while a SECOND, untouched firm is left completely
// alone (the multi-tenant isolation this whole app depends on, under test
// for the one operation where getting it wrong is irreversible).

type Db = Awaited<ReturnType<typeof import("../lib/db").getDb>>;
let db: Db;
let tables: typeof import("../lib/db").tables;
let createFirm: typeof import("../lib/firm").createFirm;
let deleteFirmCascade: typeof import("../lib/firm").deleteFirmCascade;
let issueToken: typeof import("../lib/auth-tokens").issueToken;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-delfirm-"));

beforeAll(async () => {
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  const dbMod = await import("../lib/db");
  db = await dbMod.getDb();
  tables = dbMod.tables;
  ({ createFirm } = await import("../lib/firm"));
  ({ deleteFirmCascade } = await import("../lib/firm"));
  ({ issueToken } = await import("../lib/auth-tokens"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("deleteFirmCascade", () => {
  it("removes every row the firm owns, across every firm-scoped table, and nothing else", async () => {
    // The target firm — one of everything.
    const target = await createFirm("Delete Me Law", "", "personal_injury");
    const [targetUser] = await db
      .insert(tables.users)
      .values({ firmId: target.id, email: "gone@delete-me.test", name: "Gone", passwordHash: "x", role: "admin" })
      .returning();
    await db.insert(tables.sessions).values({ token: "sess-target", userId: targetUser.id, expiresAt: "2099-01-01" });
    await issueToken(targetUser.id, "reset_password");
    await db.insert(tables.adverseParties).values({ firmId: target.id, name: "Adverse Co", relationship: "Opposing party" });
    const [lead] = await db
      .insert(tables.leads)
      .values({ id: crypto.randomUUID(), firmId: target.id, channel: "webform", fromAddress: "x@y.com", raw: "hi", status: "received" })
      .returning();
    await db.insert(tables.messages).values({
      firmId: target.id,
      leadId: lead.id,
      channel: "webform",
      toAddress: "x@y.com",
      body: "reply",
      approvedBy: targetUser.id,
    });
    await db.insert(tables.leadNotes).values({ firmId: target.id, leadId: lead.id, userId: targetUser.id, body: "note" });
    await db.insert(tables.auditEvents).values({ firmId: target.id, leadId: lead.id, userId: targetUser.id, type: "test.event" });

    // A second, untouched firm — the control group that must survive intact.
    const other = await createFirm("Keep Me Law", "", "personal_injury");
    const [otherUser] = await db
      .insert(tables.users)
      .values({ firmId: other.id, email: "stays@keep-me.test", name: "Stays", passwordHash: "x", role: "admin" })
      .returning();
    await db.insert(tables.sessions).values({ token: "sess-other", userId: otherUser.id, expiresAt: "2099-01-01" });
    await db.insert(tables.adverseParties).values({ firmId: other.id, name: "Keeper Co", relationship: "Client" });
    const [otherLead] = await db
      .insert(tables.leads)
      .values({ id: crypto.randomUUID(), firmId: other.id, channel: "webform", fromAddress: "a@b.com", raw: "hi", status: "received" })
      .returning();
    await db.insert(tables.leadNotes).values({ firmId: other.id, leadId: otherLead.id, userId: otherUser.id, body: "keep this" });
    await db.insert(tables.auditEvents).values({ firmId: other.id, leadId: otherLead.id, userId: otherUser.id, type: "test.event" });

    const counts = await deleteFirmCascade(target.id);
    expect(counts).toEqual({ users: 1, leads: 1, messages: 1, leadNotes: 1, auditEvents: 1, adverseParties: 1 });

    // The target firm and everything scoped to it is gone.
    expect(await db.select().from(tables.firms).where(eq(tables.firms.id, target.id))).toEqual([]);
    expect(await db.select().from(tables.users).where(eq(tables.users.firmId, target.id))).toEqual([]);
    expect(await db.select().from(tables.sessions).where(eq(tables.sessions.userId, targetUser.id))).toEqual([]);
    expect(await db.select().from(tables.authTokens).where(eq(tables.authTokens.userId, targetUser.id))).toEqual([]);
    expect(await db.select().from(tables.adverseParties).where(eq(tables.adverseParties.firmId, target.id))).toEqual([]);
    expect(await db.select().from(tables.leads).where(eq(tables.leads.firmId, target.id))).toEqual([]);
    expect(await db.select().from(tables.messages).where(eq(tables.messages.firmId, target.id))).toEqual([]);
    expect(await db.select().from(tables.leadNotes).where(eq(tables.leadNotes.firmId, target.id))).toEqual([]);
    expect(await db.select().from(tables.auditEvents).where(eq(tables.auditEvents.firmId, target.id))).toEqual([]);

    // The other firm's data is completely untouched — the point of the test.
    expect((await db.select().from(tables.firms).where(eq(tables.firms.id, other.id))).length).toBe(1);
    expect((await db.select().from(tables.users).where(eq(tables.users.firmId, other.id))).length).toBe(1);
    expect((await db.select().from(tables.sessions).where(eq(tables.sessions.userId, otherUser.id))).length).toBe(1);
    expect((await db.select().from(tables.adverseParties).where(eq(tables.adverseParties.firmId, other.id))).length).toBe(1);
    expect((await db.select().from(tables.leads).where(eq(tables.leads.firmId, other.id))).length).toBe(1);
    expect((await db.select().from(tables.leadNotes).where(eq(tables.leadNotes.firmId, other.id))).length).toBe(1);
    expect((await db.select().from(tables.auditEvents).where(eq(tables.auditEvents.firmId, other.id))).length).toBe(1);
  });

  it("is a no-op, not a crash, for a firm with no users and nothing else attached", async () => {
    const empty = await createFirm("Empty Law", "", "personal_injury");
    const counts = await deleteFirmCascade(empty.id);
    expect(counts).toEqual({ users: 0, leads: 0, messages: 0, leadNotes: 0, auditEvents: 0, adverseParties: 0 });
    expect(await db.select().from(tables.firms).where(eq(tables.firms.id, empty.id))).toEqual([]);
  });
});
