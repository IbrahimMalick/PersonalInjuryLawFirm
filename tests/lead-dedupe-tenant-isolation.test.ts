import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ingestLead (lib/channels/inbound.ts) and runTranscribeVoicemail
// (lib/channels/twilio.ts) — Pre-Launch Audit blocker 6. Both dedupe inbound
// messages by (channel, externalId), and for email, externalId is the
// Message-ID header — sender-controlled, not provider-assigned. Without
// firmId in that lookup (and in the leads_external_idx unique index itself),
// a crafted Message-ID colliding with another firm's existing lead would
// return THAT firm's leadId as "this firm's duplicate" — a cross-tenant
// collision, not a false negative. This proves two firms sharing the same
// (channel, externalId) land as two independent leads, while a genuine
// same-firm retry still dedupes as before.

type Db = Awaited<ReturnType<typeof import("../lib/db").getDb>>;
let db: Db;
let tables: typeof import("../lib/db").tables;
let createFirm: typeof import("../lib/firm").createFirm;
let ingestLead: typeof import("../lib/channels/inbound").ingestLead;
let runTranscribeVoicemail: typeof import("../lib/channels/twilio").runTranscribeVoicemail;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-dedupe-"));

beforeAll(async () => {
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  const dbMod = await import("../lib/db");
  db = await dbMod.getDb();
  tables = dbMod.tables;
  ({ createFirm } = await import("../lib/firm"));
  ({ ingestLead } = await import("../lib/channels/inbound"));
  ({ runTranscribeVoicemail } = await import("../lib/channels/twilio"));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("ingestLead cross-tenant dedupe isolation", () => {
  it("gives two firms independent leads even when their externalId collides", async () => {
    const firmA = await createFirm("Dedupe Firm A", "", "personal_injury");
    const firmB = await createFirm("Dedupe Firm B", "", "personal_injury");
    const sharedMessageId = "collision-id@attacker-controlled";

    const a = await ingestLead({
      firmId: firmA.id,
      channel: "email",
      externalId: sharedMessageId,
      fromAddress: "a@firma.test",
      raw: "Firm A's message",
    });
    expect(a.duplicate).toBe(false);

    const b = await ingestLead({
      firmId: firmB.id,
      channel: "email",
      externalId: sharedMessageId,
      fromAddress: "b@firmb.test",
      raw: "Firm B's message",
    });
    // The bug: this used to come back duplicate:true with firm A's leadId.
    expect(b.duplicate).toBe(false);
    expect(b.leadId).not.toBe(a.leadId);

    const leadA = (await db.select().from(tables.leads).where(eq(tables.leads.id, a.leadId)))[0];
    const leadB = (await db.select().from(tables.leads).where(eq(tables.leads.id, b.leadId)))[0];
    expect(leadA.firmId).toBe(firmA.id);
    expect(leadA.raw).toBe("Firm A's message");
    expect(leadB.firmId).toBe(firmB.id);
    expect(leadB.raw).toBe("Firm B's message");
  });

  it("still dedupes a genuine same-firm webhook retry", async () => {
    const firm = await createFirm("Dedupe Retry Firm", "", "personal_injury");
    const messageId = "retry-id@real-sender";

    const first = await ingestLead({
      firmId: firm.id,
      channel: "email",
      externalId: messageId,
      fromAddress: "x@sender.test",
      raw: "Original message",
    });
    expect(first.duplicate).toBe(false);

    const retry = await ingestLead({
      firmId: firm.id,
      channel: "email",
      externalId: messageId,
      fromAddress: "x@sender.test",
      raw: "Original message",
    });
    expect(retry.duplicate).toBe(true);
    expect(retry.leadId).toBe(first.leadId);
  });
});

describe("runTranscribeVoicemail cross-tenant dedupe isolation", () => {
  it("does not skip firm B's voicemail just because firm A has the same CallSid", async () => {
    const firmA = await createFirm("Voicemail Firm A", "", "personal_injury");
    const firmB = await createFirm("Voicemail Firm B", "", "personal_injury");
    const sharedCallSid = "CA_shared_sid";

    await ingestLead({
      firmId: firmA.id,
      channel: "voicemail",
      externalId: sharedCallSid,
      fromAddress: "+10000000000",
      raw: "Firm A voicemail",
    });

    await runTranscribeVoicemail({
      firmId: firmB.id,
      callSid: sharedCallSid,
      recordingUrl: "https://example.com/rec.mp3",
      from: "+19999999999",
    });

    const firmBLeads = await db
      .select()
      .from(tables.leads)
      .where(eq(tables.leads.firmId, firmB.id));
    expect(firmBLeads).toHaveLength(1);
    expect(firmBLeads[0].fromAddress).toBe("+19999999999");
  });
});
