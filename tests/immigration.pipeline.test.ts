import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AnyCaseFile } from "../lib/casefile";
import type { ImmigrationCaseFile } from "../lib/immigration-schema";

// End to end through the REAL pipeline (lib/pipeline.ts → practice-area
// dispatch → parse → buildCaseFile → DB write → alerts → job queue) against a
// real embedded Postgres (PGlite in a temp dir). Only two things are faked:
//   - the Claude API: canned JSON per scenario, so this proves the pipeline and
//     the trust boundary, NOT what the real model would say
//   - outbound email: captured, so we can assert alerts fire without sending

const state = vi.hoisted(() => ({
  responses: [] as string[],
  calls: [] as { system: string; user: string }[],
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async (args: { system: string; messages: { content: string }[] }) => {
        state.calls.push({ system: args.system, user: args.messages[0].content });
        const text = state.responses.shift();
        if (text === undefined) throw new Error("no mocked model response left");
        return { content: [{ type: "text", text }] };
      },
    };
  },
}));

const sent = vi.hoisted(() => [] as { to: string; subject: string; body: string }[]);
vi.mock("../lib/email", () => ({
  baseUrl: () => "http://test.local",
  sendPlatformEmail: async (to: string, subject: string, body: string) => {
    sent.push({ to, subject, body });
  },
}));

type Db = Awaited<ReturnType<typeof import("../lib/db").getDb>>;
let db: Db;
let tables: typeof import("../lib/db").tables;
let runProcessLead: typeof import("../lib/pipeline").runProcessLead;
let createFirm: typeof import("../lib/firm").createFirm;
let immFirmId: number;
let piFirmId: number;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-"));

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

function immJson(over: Record<string, unknown> = {}): string {
  const base = {
    caseType: "family_based",
    applicant: { name: "Maria Lopez", phone: "(212) 555-0101", email: null, preferredLanguage: "en", countryOfCitizenship: "Mexico" },
    currentStatus: "pending_application",
    currentStatusDetail: null,
    statusExpirationDate: null,
    lastEntryDate: null,
    petitionerOrSponsor: { name: null, relationship: "unknown" },
    namedParties: [],
    pendingFiling: { formType: null, receiptNumber: null, filedDate: null },
    noticeReceived: { type: "none", noticeDate: null },
    removal: { inRemovalProceedings: false, nextHearingDate: null, ijDecisionDate: null, isDetained: false },
    priorRepresentation: "unknown",
    priorityScore: 50,
    scoreRationale: "Wants an update on a pending petition.",
    routing: "schedule_consult",
    missingInfo: [],
    confidence: 0.9,
    needsHumanReview: false,
    draftReply: "Thank you for writing. A member of our team will be in touch.",
    ...over,
  };
  return JSON.stringify(base);
}

const piJson = JSON.stringify({
  caseType: "motor_vehicle",
  incidentDate: "2026-08-01",
  incidentLocation: "Atlantic Ave",
  claimant: { name: "Jane Doe", phone: "(347) 555-0100", email: null, preferredLanguage: "en" },
  injuryDescription: "Whiplash",
  treatmentStatus: "er_visit",
  liabilityClarity: "clear",
  liabilityNote: "Rear-ended.",
  otherPartyInfo: { name: "John Roe", insurer: "GEICO", policyLimits: null },
  priorRepresentation: false,
  jurisdiction: "NY",
  priorityScore: 88,
  scoreRationale: "Clear liability.",
  routing: "sign_now",
  missingInfo: [],
  confidence: 0.9,
  needsHumanReview: false,
  draftReply: "Hi Jane.",
});

async function addLead(firmId: number, raw: string, meta: Record<string, unknown> = {}): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(tables.leads).values({
    id,
    firmId,
    channel: "webform",
    fromAddress: "sender@example.com",
    raw,
    meta,
    status: "received",
  });
  return id;
}

async function triage(firmId: number, raw: string, responses: string[], meta: Record<string, unknown> = {}) {
  state.responses = [...responses];
  const id = await addLead(firmId, raw, meta);
  await runProcessLead(id);
  const row = (await db.select().from(tables.leads).where((await import("drizzle-orm")).eq(tables.leads.id, id)))[0];
  return { id, row, cf: row.caseFile as unknown as AnyCaseFile };
}

beforeAll(async () => {
  setupEnv();
  const dbMod = await import("../lib/db");
  db = await dbMod.getDb();
  tables = dbMod.tables;
  ({ runProcessLead } = await import("../lib/pipeline"));
  ({ createFirm } = await import("../lib/firm"));

  const imm = await createFirm("Ortiz Law", "", "immigration");
  const pi = await createFirm("Reyes Injury", "", "personal_injury");
  immFirmId = imm.id;
  piFirmId = pi.id;
  expect(imm.practiceLine).toBe("Immigration Law"); // defaulted from the area
  expect(pi.practiceLine).toBe("Injury Law");
  for (const [firmId, email] of [
    [immFirmId, "attorney@ortiz.test"],
    [piFirmId, "attorney@reyes.test"],
  ] as const) {
    await db.insert(tables.users).values({
      firmId,
      email,
      name: "Attorney",
      passwordHash: "x",
      role: "admin",
    });
  }
  // A conflict-list entry for the immigration firm only.
  await db.insert(tables.adverseParties).values({
    firmId: immFirmId,
    name: "Carlos Lopez",
    relationship: "Current client",
  });
});

function setupEnv() {
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.GHL_SYNC_LEADS;
}

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("immigration firm, end to end (model mocked)", () => {
  it("(a) an RFE-response question: computes the deadline, not time-critical, no alert", async () => {
    sent.length = 0;
    const noticeDate = iso(-14);
    const { cf, row } = await triage(
      immFirmId,
      "I got a Request for Evidence for my I-130 two weeks ago. What do I do?",
      [
        immJson({
          noticeReceived: { type: "rfe", noticeDate },
          pendingFiling: { formType: "I-130", receiptNumber: null, filedDate: null },
        }),
      ]
    );
    expect(row.status).toBe("triaged");
    expect(cf.practiceArea).toBe("immigration");
    const imm = cf as ImmigrationCaseFile;
    expect(imm.deadlines[0]).toMatchObject({ trigger: "rfe", kind: "computed" });
    // 84-day window, notice 14 days ago: 70 days less however much of today has
    // elapsed (floor, the same convention as the PI statute-of-limitations math).
    expect(imm.deadlines[0].daysRemaining).toBeGreaterThanOrEqual(69);
    expect(imm.deadlines[0].daysRemaining).toBeLessThanOrEqual(70);
    expect(imm.timeCritical).toBe(false);
    expect(sent).toHaveLength(0);
    // the immigration prompt was used, with the immigration rules and no PI text
    const system = state.calls.at(-1)!.system.replace(/\s+/g, " ");
    expect(system).toContain("processing times");
    expect(system).not.toContain("statute-of-limitations deadline");
  });

  it("(b) a detained family member: time-critical, alerts everyone, never declined, code-written draft", async () => {
    sent.length = 0;
    const before = (await db.select().from(tables.jobs)).length;
    const { cf, row } = await triage(
      immFirmId,
      "My brother was picked up by ICE this morning and I don't know where he is.",
      [
        immJson({
          caseType: "removal_defense",
          routing: "decline", // the model got it wrong — code must not honour it
          removal: { inRemovalProceedings: "unknown", nextHearingDate: null, ijDecisionDate: null, isDetained: true },
          draftReply: "You should file a motion immediately and you will win.", // must never survive
        }),
      ]
    );
    const imm = cf as ImmigrationCaseFile;
    expect(imm.timeCritical).toBe(true);
    expect(imm.timeCriticalReasons).toContain("Person may be detained");
    expect(imm.routing).toBe("schedule_consult");
    expect(imm.needsHumanReview).toBe(true);
    expect(row.draftReply).not.toMatch(/motion|win/i);
    expect(row.draftReply).toMatch(/911/);
    // alert: immediate email to the firm's user, with reasons but no dates
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("attorney@ortiz.test");
    expect(sent[0].subject).toMatch(/TIME-CRITICAL/);
    expect(sent[0].body).toMatch(/Person may be detained/);
    expect(sent[0].body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    // escalation reminder queued through the existing escalate_lead job
    const jobs = await db.select().from(tables.jobs);
    expect(jobs.length).toBe(before + 1);
    expect(jobs.at(-1)).toMatchObject({ type: "escalate_lead" });
    // the audit trail records the categories
    const trail = await db.select().from(tables.auditEvents);
    expect(trail.some((e) => e.type === "lead.time_critical" && e.leadId === row.id)).toBe(true);
  });

  it("(b2) an imminent hearing (10 days) is time-critical even with no detention", async () => {
    sent.length = 0;
    const { cf } = await triage(immFirmId, "I have court on the 4th.", [
      immJson({
        removal: { inRemovalProceedings: true, nextHearingDate: iso(10), ijDecisionDate: null, isDetained: false },
        routing: "nurture",
      }),
    ]);
    const imm = cf as ImmigrationCaseFile;
    expect(imm.timeCritical).toBe(true);
    expect(imm.routing).toBe("schedule_consult");
    expect(sent).toHaveLength(1);
  });

  it("(b3) the form's detained answer is a backstop when the model misses it", async () => {
    sent.length = 0;
    const { cf } = await triage(
      immFirmId,
      "Please call me.\nCurrently detained: Yes",
      [immJson()], // model says isDetained: false
      { formFields: { "Currently detained": "Yes" } }
    );
    expect((cf as ImmigrationCaseFile).timeCritical).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("(c) a Spanish green-card question: drafts and stores the language, computes nothing it wasn't given", async () => {
    sent.length = 0;
    const { cf, row } = await triage(
      immFirmId,
      "Hola, mi esposo es residente y quiero saber cómo pedir mi tarjeta verde.",
      [
        immJson({
          applicant: { name: "Rosa Peralta", phone: null, email: "rosa@example.com", preferredLanguage: "es", countryOfCitizenship: "Guatemala" },
          draftReply: "Hola Rosa, gracias por escribirnos. Un miembro de nuestro equipo se comunicará con usted.",
        }),
      ]
    );
    const imm = cf as ImmigrationCaseFile;
    expect(imm.applicant.preferredLanguage).toBe("es");
    expect(row.draftLanguage).toBe("es");
    expect(imm.deadlines).toEqual([]);
    expect(imm.timeCritical).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("(d) a vague inquiry: low confidence forces review, nothing invented", async () => {
    const { cf } = await triage(immFirmId, "hi i need help with papers", [
      immJson({ caseType: "other", applicant: { name: null, phone: null, email: null, preferredLanguage: "en", countryOfCitizenship: null }, confidence: 0.4, routing: "nurture", priorityScore: 20 }),
    ]);
    const imm = cf as ImmigrationCaseFile;
    expect(imm.needsHumanReview).toBe(true);
    expect(imm.deadlines).toEqual([]);
    expect(imm.timeCritical).toBe(false);
  });

  it("(e) an off-topic message: not_a_case, declined, quiet", async () => {
    sent.length = 0;
    const { cf } = await triage(immFirmId, "Do you sell car insurance?", [
      immJson({ caseType: "not_a_case", routing: "decline", priorityScore: 2 }),
    ]);
    const imm = cf as ImmigrationCaseFile;
    expect(imm.caseType).toBe("not_a_case");
    expect(imm.routing).toBe("decline");
    expect(imm.timeCritical).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("holds a lead that names a person on the firm's conflict list", async () => {
    const { cf } = await triage(immFirmId, "My uncle Carlos Lopez is my sponsor.", [
      immJson({ petitionerOrSponsor: { name: "Carlos Lopez", relationship: "family_member" } }),
    ]);
    expect(cf.conflictFlags).toEqual(["Carlos Lopez — Current client"]);
    expect(cf.needsHumanReview).toBe(true);
  });

  it("retries once on invalid JSON, then succeeds", async () => {
    const { cf } = await triage(immFirmId, "Question about my case.", ["not json at all", immJson()]);
    expect(cf.practiceArea).toBe("immigration");
  });

  it("never returns a canned answer: two failures throw so the worker flags it", async () => {
    state.responses = ["nope", "still nope"];
    const id = await addLead(immFirmId, "Anything.");
    await expect(runProcessLead(id)).rejects.toThrow();
    const row = (await db.select().from(tables.leads).where((await import("drizzle-orm")).eq(tables.leads.id, id)))[0];
    expect(row.status).not.toBe("triaged");
    expect(row.caseFile).toBeNull();
  });

  it("rejects a PI-shaped answer for an immigration firm (each firm gets its own contract)", async () => {
    state.responses = [piJson, piJson];
    const id = await addLead(immFirmId, "Anything.");
    await expect(runProcessLead(id)).rejects.toThrow(/Schema validation failed/);
  });
});

describe("personal-injury firm, regression (model mocked)", () => {
  it("is processed exactly as before: PI contract, table-computed SOL, sign_now alert", async () => {
    sent.length = 0;
    const { cf } = await triage(piFirmId, "I was rear-ended on Atlantic Ave.", [piJson]);
    expect(cf.practiceArea).toBeUndefined(); // stored PI shape has no discriminant
    expect("statuteOfLimitations" in cf).toBe(true);
    expect((cf as { statuteOfLimitations: { deadlineISO: string } }).statuteOfLimitations.deadlineISO).toBe("2029-08-01");
    expect(cf.needsHumanReview).toBe(true);
    const system = state.calls.at(-1)!.system.replace(/\s+/g, " ");
    expect(system).toContain("statute-of-limitations deadline");
    expect(system).not.toContain("processing times");
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toMatch(/^New Sign Now lead — Jane Doe/);
    expect(sent[0].body).toMatch(/Injury: Whiplash/);
    expect(sent[0].to).toBe("attorney@reyes.test"); // and never the other firm's user
  });

  it("does not accept an immigration-shaped answer", async () => {
    state.responses = [immJson(), immJson()];
    const id = await addLead(piFirmId, "Anything.");
    await expect(runProcessLead(id)).rejects.toThrow(/Schema validation failed/);
  });
});
