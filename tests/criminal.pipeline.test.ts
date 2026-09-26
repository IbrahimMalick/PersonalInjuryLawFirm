import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AnyCaseFile } from "../lib/casefile";
import type { CriminalCaseFile } from "../lib/criminal-schema";

// End to end through the REAL pipeline (lib/pipeline.ts → practice-area
// dispatch → parse → buildCriminalCaseFile → DB write → alerts → job queue)
// against a real embedded Postgres (PGlite in a temp dir). Only two things are
// faked: the Claude API (canned JSON per scenario — this proves the pipeline
// and the trust boundary, NOT what the real model would say) and outbound
// email (captured, so we can assert alerts fire without sending).

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
let critFirmId: number;
let immFirmId: number;
let piFirmId: number;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-crim-"));

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

function critJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    caseType: "drug",
    contact: { name: "Grace Okoye", phone: "(713) 555-0100", email: null, preferredLanguage: "en" },
    writerRole: "family_or_friend",
    defendantName: "Daniel Okoye",
    custody: { inCustody: false, arrestDate: null, heldAt: null, bailStatus: "unknown" },
    court: { courtName: null, jurisdiction: "Harris County", nextCourtDate: null, hearingType: "unknown", caseStage: "charged", convictionDate: null },
    chargesStated: ["possession"],
    onProbationOrParole: false,
    hasActiveWarrant: false,
    namedParties: [],
    priorRepresentation: false,
    priorityScore: 55,
    scoreRationale: "Family member wants a consult.",
    routing: "schedule_consult",
    missingInfo: [],
    confidence: 0.9,
    needsHumanReview: false,
    ...over,
  });
}

const immJson = JSON.stringify({
  caseType: "family_based",
  applicant: { name: "Maria Lopez", phone: null, email: null, preferredLanguage: "en", countryOfCitizenship: null },
  currentStatus: "unknown",
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
  scoreRationale: "x",
  routing: "schedule_consult",
  missingInfo: [],
  confidence: 0.9,
  needsHumanReview: false,
  draftReply: "Hello.",
});

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
  await db.insert(tables.leads).values({ id, firmId, channel: "webform", fromAddress: "sender@example.com", raw, meta, status: "received" });
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
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.GHL_SYNC_LEADS;
  const dbMod = await import("../lib/db");
  db = await dbMod.getDb();
  tables = dbMod.tables;
  ({ runProcessLead } = await import("../lib/pipeline"));
  ({ createFirm } = await import("../lib/firm"));

  const crim = await createFirm("Okafor Defense", "", "criminal_defense");
  const imm = await createFirm("Ortiz Law", "", "immigration");
  const pi = await createFirm("Reyes Injury", "", "personal_injury");
  critFirmId = crim.id;
  immFirmId = imm.id;
  piFirmId = pi.id;
  expect(crim.practiceLine).toBe("Criminal Defense"); // defaulted from the area
  for (const [firmId, email] of [
    [critFirmId, "attorney@okafor.test"],
    [immFirmId, "attorney@ortiz.test"],
    [piFirmId, "attorney@reyes.test"],
  ] as const) {
    await db.insert(tables.users).values({ firmId, email, name: "Attorney", passwordHash: "x", role: "admin" });
  }
  await db.insert(tables.adverseParties).values({ firmId: critFirmId, name: "Rita Vance", relationship: "Current client" });
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("criminal-defense firm, end to end (model mocked)", () => {
  it("(a) an arrest with the person in custody: time-critical, alerts everyone, never declined, fixed urgent reply", async () => {
    sent.length = 0;
    const before = (await db.select().from(tables.jobs)).length;
    const { cf, row } = await triage(critFirmId, "My son was arrested last night and is at the county jail.", [
      critJson({
        custody: { inCustody: true, arrestDate: iso(-1), heldAt: "Harris County Jail", bailStatus: "not_set" },
        routing: "decline", // the model got it wrong — code must not honour it
      }),
    ]);
    expect(row.status).toBe("triaged");
    const crim = cf as CriminalCaseFile;
    expect(crim.practiceArea).toBe("criminal_defense");
    expect(crim.timeCritical).toBe(true);
    expect(crim.timeCriticalReasons).toContain("Person may be in custody");
    expect(crim.routing).toBe("schedule_consult");
    expect(crim.needsHumanReview).toBe(true);
    expect(row.draftReply).toMatch(/please do not describe what happened/);
    expect(row.draftReply).toMatch(/as soon as possible/);
    expect(row.draftReply).toMatch(/911/);
    // alert: immediate email to the firm's user, with reasons but no dates
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("attorney@okafor.test");
    expect(sent[0].subject).toMatch(/TIME-CRITICAL/);
    expect(sent[0].body).toMatch(/Person may be in custody/);
    expect(sent[0].body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(sent[0].body).not.toMatch(/Injury:/);
    const jobs = await db.select().from(tables.jobs);
    expect(jobs.length).toBe(before + 1);
    expect(jobs.at(-1)).toMatchObject({ type: "escalate_lead" });
    const trail = await db.select().from(tables.auditEvents);
    expect(trail.some((e) => e.type === "lead.time_critical" && e.leadId === row.id)).toBe(true);
    // the criminal prompt was used — and never the PI or immigration one
    const system = state.calls.at(-1)!.system.replace(/\s+/g, " ");
    expect(system).toContain("record, summarize, or repeat what the person is accused of doing");
    expect(system).not.toContain("statute-of-limitations deadline");
    expect(system).not.toContain("processing times");
  });

  it("(b) a court date in 3 days is time-critical even with no custody", async () => {
    sent.length = 0;
    const { cf } = await triage(critFirmId, "My brother has court on Tuesday.", [
      critJson({ court: { courtName: "Harris County Court", jurisdiction: "Harris County", nextCourtDate: iso(3), hearingType: "arraignment", caseStage: "pending", convictionDate: null }, routing: "nurture" }),
    ]);
    const crim = cf as CriminalCaseFile;
    expect(crim.timeCritical).toBe(true);
    expect(crim.routing).toBe("schedule_consult");
    expect(crim.deadlines[0]).toMatchObject({ trigger: "court_date", kind: "computed" });
    expect(crim.deadlines[0].daysRemaining).toBe(3);
    expect(sent).toHaveLength(1);
  });

  it("(c) an active warrant is time-critical", async () => {
    sent.length = 0;
    const { cf } = await triage(critFirmId, "I heard there is a warrant out for me.", [
      critJson({ hasActiveWarrant: true, writerRole: "defendant", defendantName: null }),
    ]);
    expect((cf as CriminalCaseFile).timeCritical).toBe(true);
    expect((cf as CriminalCaseFile).timeCriticalReasons).toContain("An active warrant was reported");
    expect(sent).toHaveLength(1);
  });

  it("(d) a routine consult still gets the fixed reply — the model's own text never reaches the draft", async () => {
    sent.length = 0;
    const { cf, row } = await triage(critFirmId, "I got a possession charge and want to talk to someone.", [
      critJson({ draftReply: "Don't worry, you will definitely win this. Do not talk to the police." }),
    ]);
    const crim = cf as CriminalCaseFile;
    expect(crim.timeCritical).toBe(false);
    expect(sent).toHaveLength(0);
    expect(row.draftReply).toMatch(/please do not describe what happened/);
    expect(row.draftReply).not.toMatch(/win|police/i);
    expect(JSON.stringify(row.caseFile)).not.toMatch(/definitely win/);
  });

  it("(e) a sender who narrates the incident: the case file holds none of it", async () => {
    const story = "He was drinking at the bar and then took a swing at the guy and drove home";
    const { row, cf } = await triage(critFirmId, `My husband was arrested. ${story}.`, [
      critJson({
        caseType: "assault_violence",
        chargesStated: ["assault"],
        // a model that ignores its instructions and stuffs the story somewhere
        incidentDescription: story,
        scoreRationale: "Family member reports an arrest. " + story + ".",
      }),
    ]);
    expect(JSON.stringify(row.caseFile)).not.toMatch(/drinking|swing|drove home/);
    expect((cf as CriminalCaseFile).scoreRationale).toBe("Family member reports an arrest.");
    // what the prompt told the model to do with narrative
    expect(state.calls.at(-1)!.system).toMatch(/NEVER record, summarize, quote, or repeat/);
  });

  it("(f) a Spanish message gets the Spanish fixed reply and the language is stored", async () => {
    const { row, cf } = await triage(critFirmId, "Mi hijo fue arrestado anoche.", [
      critJson({ contact: { name: "Carmen Ruiz", phone: null, email: "carmen@example.com", preferredLanguage: "es" }, custody: { inCustody: true, arrestDate: null, heldAt: null, bailStatus: "unknown" } }),
    ]);
    expect((cf as CriminalCaseFile).contact.preferredLanguage).toBe("es");
    expect(row.draftLanguage).toBe("es");
    expect(row.draftReply).toMatch(/no describa lo sucedido/);
    expect(row.draftReply).toMatch(/lo antes posible/);
  });

  it("(g) the form's in-custody answer is a backstop when the model misses it", async () => {
    sent.length = 0;
    const { cf } = await triage(
      critFirmId,
      "Please call me.\nIs the person currently in custody? (form question, answered by sender): Yes",
      [critJson()], // model says inCustody: false
      { formFields: { "In custody": "Yes" } }
    );
    expect((cf as CriminalCaseFile).timeCritical).toBe(true);
    expect((cf as CriminalCaseFile).custody.inCustody).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("(h) a vague inquiry: low confidence forces review, nothing invented", async () => {
    const { cf } = await triage(critFirmId, "hi i need a lawyer", [
      critJson({ caseType: "other", contact: { name: null, phone: null, email: null, preferredLanguage: "en" }, defendantName: null, chargesStated: [], confidence: 0.4, routing: "nurture", priorityScore: 20, court: { courtName: null, jurisdiction: null, nextCourtDate: null, hearingType: "unknown", caseStage: "unknown", convictionDate: null } }),
    ]);
    const crim = cf as CriminalCaseFile;
    expect(crim.needsHumanReview).toBe(true);
    expect(crim.deadlines).toEqual([]);
    expect(crim.timeCritical).toBe(false);
  });

  it("(i) an off-topic message: not_a_case, declined, quiet", async () => {
    sent.length = 0;
    const { cf } = await triage(critFirmId, "Do you do real estate closings?", [
      critJson({ caseType: "not_a_case", routing: "decline", priorityScore: 2, chargesStated: [], defendantName: null }),
    ]);
    expect(cf.caseType).toBe("not_a_case");
    expect(cf.routing).toBe("decline");
    expect((cf as CriminalCaseFile).timeCritical).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("holds a lead that names someone on the firm's conflict list", async () => {
    const { cf } = await triage(critFirmId, "My cousin Rita Vance is the one who called the police.", [
      critJson({ namedParties: ["Rita Vance"] }),
    ]);
    expect(cf.conflictFlags).toEqual(["Rita Vance — Current client"]);
    expect(cf.needsHumanReview).toBe(true);
  });

  it("retries once on invalid JSON, then succeeds", async () => {
    const { cf } = await triage(critFirmId, "Question about my case.", ["not json at all", critJson()]);
    expect(cf.practiceArea).toBe("criminal_defense");
  });

  it("never returns a canned answer: two failures throw so the worker flags it", async () => {
    state.responses = ["nope", "still nope"];
    const id = await addLead(critFirmId, "Anything.");
    await expect(runProcessLead(id)).rejects.toThrow();
    const row = (await db.select().from(tables.leads).where((await import("drizzle-orm")).eq(tables.leads.id, id)))[0];
    expect(row.status).not.toBe("triaged");
    expect(row.caseFile).toBeNull();
  });

  it("rejects PI-shaped and immigration-shaped answers (each firm gets its own contract)", async () => {
    for (const wrong of [piJson, immJson]) {
      state.responses = [wrong, wrong];
      const id = await addLead(critFirmId, "Anything.");
      await expect(runProcessLead(id)).rejects.toThrow(/Schema validation failed/);
    }
  });
});

describe("other practice areas, regression with criminal defense added", () => {
  it("personal injury is processed exactly as before", async () => {
    sent.length = 0;
    const { cf } = await triage(piFirmId, "I was rear-ended on Atlantic Ave.", [piJson]);
    expect(cf.practiceArea).toBeUndefined();
    expect((cf as { statuteOfLimitations: { deadlineISO: string } }).statuteOfLimitations.deadlineISO).toBe("2029-08-01");
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toMatch(/^New Sign Now lead — Jane Doe/);
    expect(sent[0].body).toMatch(/Injury: Whiplash/);
  });

  it("immigration still gets its own prompt and the model's own draft", async () => {
    const { cf, row } = await triage(immFirmId, "Question about my petition.", [immJson]);
    expect(cf.practiceArea).toBe("immigration");
    expect(row.draftReply).toBe("Hello.");
    expect(state.calls.at(-1)!.system.replace(/\s+/g, " ")).toContain("processing times");
  });

  it("a criminal-shaped answer is rejected for the other two areas", async () => {
    for (const firmId of [piFirmId, immFirmId]) {
      state.responses = [critJson(), critJson()];
      const id = await addLead(firmId, "Anything.");
      await expect(runProcessLead(id)).rejects.toThrow(/Schema validation failed/);
    }
  });
});
