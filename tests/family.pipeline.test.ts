import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AnyCaseFile } from "../lib/casefile";
import type { FamilyCaseFile } from "../lib/family-schema";

// End to end through the REAL pipeline (lib/pipeline.ts → practice-area
// dispatch → parse → buildFamilyCaseFile → DB write → alerts → job queue)
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
let famFirmId: number;
let piFirmId: number;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-fam-"));

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

function famJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    caseType: "child_custody",
    contact: { name: "Maria Chen", phone: "(415) 555-0100", email: null, preferredLanguage: "en" },
    otherParty: { name: "David Chen", relationship: "former_spouse" },
    childrenInvolved: true,
    safetyConcern: false,
    existingProtectiveOrder: false,
    court: {
      courtName: null,
      jurisdiction: "San Francisco County",
      caseNumber: null,
      caseStage: "pending",
      nextHearingDate: null,
      hearingType: "unknown",
      responseDueDate: null,
    },
    servedWithPapers: false,
    namedParties: [],
    priorRepresentation: false,
    priorityScore: 55,
    scoreRationale: "Parent wants to discuss a custody schedule.",
    routing: "schedule_consult",
    missingInfo: [],
    confidence: 0.9,
    needsHumanReview: false,
    draftReply: "Thank you for reaching out. A member of our team will be in touch.",
    ...over,
  });
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

  const fam = await createFirm("Reyes Family Law", "", "family_law");
  const pi = await createFirm("Reyes Injury", "", "personal_injury");
  famFirmId = fam.id;
  piFirmId = pi.id;
  expect(fam.practiceLine).toBe("Family Law"); // defaulted from the area
  for (const [firmId, email] of [
    [famFirmId, "attorney@reyesfamily.test"],
    [piFirmId, "attorney@reyes.test"],
  ] as const) {
    await db.insert(tables.users).values({ firmId, email, name: "Attorney", passwordHash: "x", role: "admin" });
  }
  await db.insert(tables.adverseParties).values({ firmId: famFirmId, name: "David Chen", relationship: "Existing client" });
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("family-law firm, end to end (model mocked)", () => {
  it("(a) a reported safety concern: time-critical, alerts everyone, never declined, fixed acknowledgment overrides the model's own reply", async () => {
    sent.length = 0;
    const before = (await db.select().from(tables.jobs)).length;
    const { cf, row } = await triage(famFirmId, "I need to get away from my husband, I'm scared.", [
      famJson({
        safetyConcern: true,
        routing: "decline", // the model got it wrong — code must not honour it
        draftReply: "Here is some advice: you should file for a restraining order immediately.",
      }),
    ]);
    expect(row.status).toBe("triaged");
    const fam = cf as FamilyCaseFile;
    expect(fam.practiceArea).toBe("family_law");
    expect(fam.timeCritical).toBe(true);
    expect(fam.timeCriticalReasons).toContain("A safety concern was reported");
    expect(fam.routing).toBe("schedule_consult");
    expect(fam.needsHumanReview).toBe(true);
    expect(row.draftReply).not.toMatch(/file for a restraining order/);
    expect(row.draftReply).toMatch(/as soon as possible/);
    expect(row.draftReply).toMatch(/911/);
    // alert: immediate email to the firm's user, with reasons but no dates
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("attorney@reyesfamily.test");
    expect(sent[0].subject).toMatch(/TIME-CRITICAL/);
    expect(sent[0].body).toMatch(/A safety concern was reported/);
    expect(sent[0].body).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(sent[0].body).not.toMatch(/Injury:/);
    const jobs = await db.select().from(tables.jobs);
    expect(jobs.length).toBe(before + 1);
    expect(jobs.at(-1)).toMatchObject({ type: "escalate_lead" });
    const trail = await db.select().from(tables.auditEvents);
    expect(trail.some((e) => e.type === "lead.time_critical" && e.leadId === row.id)).toBe(true);
    // the family-law prompt was used — and never the PI, immigration, or criminal one
    const system = state.calls.at(-1)!.system.replace(/\s+/g, " ");
    expect(system).toContain("ask the sender to describe an incident of abuse or violence");
    expect(system).not.toContain("statute-of-limitations deadline");
    expect(system).not.toContain("processing times");
    expect(system).not.toContain("record, summarize, or repeat what the person is accused of doing");
  });

  it("(b) a hearing in 3 days is time-critical even with no safety concern", async () => {
    sent.length = 0;
    const { cf } = await triage(famFirmId, "We have a hearing this week.", [
      famJson({
        court: { courtName: "SF Family Court", jurisdiction: "San Francisco County", caseNumber: null, caseStage: "pending", nextHearingDate: iso(3), hearingType: "temporary_orders", responseDueDate: null },
        routing: "nurture",
      }),
    ]);
    const fam = cf as FamilyCaseFile;
    expect(fam.timeCritical).toBe(true);
    expect(fam.routing).toBe("schedule_consult");
    expect(fam.deadlines[0]).toMatchObject({ trigger: "hearing", kind: "stated" });
    expect(fam.deadlines[0].daysRemaining).toBe(3);
    expect(sent).toHaveLength(1);
  });

  it("(c) a routine consult keeps the model's own drafted reply — nothing is overridden", async () => {
    sent.length = 0;
    const { cf, row } = await triage(famFirmId, "I want to talk about a custody schedule.", [
      famJson({ draftReply: "Thank you for writing — someone will call you back soon." }),
    ]);
    const fam = cf as FamilyCaseFile;
    expect(fam.timeCritical).toBe(false);
    expect(sent).toHaveLength(0);
    expect(row.draftReply).toBe("Thank you for writing — someone will call you back soon.");
  });

  it("(d) a sender who describes a safety incident: the case file holds only the flag, not the account", async () => {
    const story = "He grabbed me by the arm and threatened me in front of our daughter";
    const { row, cf } = await triage(famFirmId, `I have a safety concern. ${story}.`, [
      famJson({
        safetyConcern: true,
        // a model that ignores its instructions and stuffs the story somewhere
        scoreRationale: "Parent reports a safety concern. " + story + ".",
      }),
    ]);
    expect(JSON.stringify(row.caseFile)).not.toMatch(/grabbed|threatened/);
    expect((cf as FamilyCaseFile).scoreRationale).toBe("Parent reports a safety concern.");
    // what the prompt told the model to do with an incident description
    expect(state.calls.at(-1)!.system.replace(/\s+/g, " ")).toMatch(
      /NEVER ask the sender to describe an incident/
    );
  });

  it("(e) a Spanish message during a safety concern gets the Spanish acknowledgment", async () => {
    const { row, cf } = await triage(famFirmId, "Tengo miedo de mi esposo.", [
      famJson({ contact: { name: "Sofia Reyes", phone: null, email: "sofia@example.com", preferredLanguage: "es" }, safetyConcern: true }),
    ]);
    expect((cf as FamilyCaseFile).contact.preferredLanguage).toBe("es");
    expect(row.draftLanguage).toBe("es");
    expect(row.draftReply).toMatch(/lo antes posible/);
    expect(row.draftReply).toMatch(/911/);
  });

  it("(f) the form's safety-concern answer is a backstop when the model misses it", async () => {
    sent.length = 0;
    const { cf } = await triage(
      famFirmId,
      "Please call me.\nDo you have a safety concern? (form question, answered by sender): Yes",
      [famJson()], // model says safetyConcern: false
      { formFields: { "Safety concern": "Yes" } }
    );
    expect((cf as FamilyCaseFile).timeCritical).toBe(true);
    expect((cf as FamilyCaseFile).safetyConcern).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("(g) a vague inquiry: low confidence forces review, nothing invented", async () => {
    const { cf } = await triage(famFirmId, "hi i need a lawyer", [
      famJson({ caseType: "other", contact: { name: null, phone: null, email: null, preferredLanguage: "en" }, otherParty: { name: null, relationship: "unknown" }, confidence: 0.4, routing: "nurture", priorityScore: 20 }),
    ]);
    const fam = cf as FamilyCaseFile;
    expect(fam.needsHumanReview).toBe(true);
    expect(fam.deadlines).toEqual([]);
    expect(fam.timeCritical).toBe(false);
  });

  it("(h) an off-topic message: not_a_case, declined, quiet", async () => {
    sent.length = 0;
    const { cf } = await triage(famFirmId, "Do you handle bankruptcy filings?", [
      famJson({ caseType: "not_a_case", routing: "decline", priorityScore: 2 }),
    ]);
    expect(cf.caseType).toBe("not_a_case");
    expect(cf.routing).toBe("decline");
    expect((cf as FamilyCaseFile).timeCritical).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("holds a lead that names the other party already on the firm's conflict list", async () => {
    const { cf } = await triage(famFirmId, "My ex David Chen and I need to sort out custody.", [famJson()]);
    expect(cf.conflictFlags).toEqual(["David Chen — Existing client"]);
    expect(cf.needsHumanReview).toBe(true);
  });

  it("retries once on invalid JSON, then succeeds", async () => {
    const { cf } = await triage(famFirmId, "Question about my case.", ["not json at all", famJson()]);
    expect(cf.practiceArea).toBe("family_law");
  });

  it("never returns a canned answer: two failures throw so the worker flags it", async () => {
    state.responses = ["nope", "still nope"];
    const id = await addLead(famFirmId, "Anything.");
    await expect(runProcessLead(id)).rejects.toThrow();
    const row = (await db.select().from(tables.leads).where((await import("drizzle-orm")).eq(tables.leads.id, id)))[0];
    expect(row.status).not.toBe("triaged");
    expect(row.caseFile).toBeNull();
  });

  it("rejects a PI-shaped answer for a family-law firm (each firm gets its own contract)", async () => {
    state.responses = [piJson, piJson];
    const id = await addLead(famFirmId, "Anything.");
    await expect(runProcessLead(id)).rejects.toThrow(/Schema validation failed/);
  });
});

describe("other practice areas, regression with family law added", () => {
  it("personal injury is processed exactly as before", async () => {
    sent.length = 0;
    const { cf } = await triage(piFirmId, "I was rear-ended on Atlantic Ave.", [piJson]);
    expect(cf.practiceArea).toBeUndefined();
    expect((cf as { statuteOfLimitations: { deadlineISO: string } }).statuteOfLimitations.deadlineISO).toBe("2029-08-01");
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toMatch(/^New Sign Now lead — Jane Doe/);
    expect(sent[0].body).toMatch(/Injury: Whiplash/);
  });

  it("a family-law-shaped answer is rejected for personal injury", async () => {
    state.responses = [famJson(), famJson()];
    const id = await addLead(piFirmId, "Anything.");
    await expect(runProcessLead(id)).rejects.toThrow(/Schema validation failed/);
  });
});
