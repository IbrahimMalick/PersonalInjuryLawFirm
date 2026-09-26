import { describe, expect, it } from "vitest";
import { parseDefensively, ExtractionError, buildCaseFile } from "../lib/extract";
import { computeSOL } from "../lib/sol-table";
import { matchConflicts } from "../lib/conflicts";
import { resolveReplyDestination } from "../lib/reply";
import type { LeadRow } from "../lib/db/schema";
import type { ModelOutput } from "../lib/schema";
import { matchNames } from "../lib/conflicts";
import {
  contactOf,
  guidanceSentence,
  isHighPriority,
  isImmigrationCaseFile,
  practiceAreaOf,
  splitStatusDetail,
} from "../lib/casefile";
import {
  CONDUCT_RULES_TEMPLATE,
  conductRules,
  disclaimerFor,
  timeCriticalAckFor,
} from "../lib/guardrails";
import {
  IMMIGRATION_RULES,
  computeImmigrationDeadlines,
  computeTimeCritical,
  type ImmigrationTriggers,
} from "../lib/immigration-deadlines";
import {
  buildImmigrationCaseFile,
  immigrationExtractor,
  parseImmigrationDefensively,
} from "../lib/immigration";
import type { ImmigrationModelOutput } from "../lib/immigration-schema";
import { leadUrgency } from "../lib/urgency";
import { noteBody } from "../lib/channels/ghl-sync";

const validOutput: ModelOutput = {
  caseType: "motor_vehicle",
  incidentDate: "2026-08-01",
  incidentLocation: "Atlantic Ave, Brooklyn",
  claimant: { name: "Jane Doe", phone: "(347) 555-0100", email: null, preferredLanguage: "en" },
  injuryDescription: "Whiplash",
  treatmentStatus: "er_visit",
  liabilityClarity: "clear",
  liabilityNote: "Rear-ended while stopped.",
  otherPartyInfo: { name: "John Roe", insurer: "GEICO", policyLimits: null },
  priorRepresentation: false,
  jurisdiction: "NY",
  priorityScore: 88,
  scoreRationale: "Clear liability with ER documentation.",
  routing: "sign_now",
  missingInfo: ["Police report number"],
  confidence: 0.9,
  needsHumanReview: false,
  draftReply: "Hi Jane — we got your message.",
};

describe("parseDefensively", () => {
  it("parses clean JSON", () => {
    expect(parseDefensively(JSON.stringify(validOutput)).caseType).toBe("motor_vehicle");
  });
  it("strips fences and preamble", () => {
    const wrapped = "Here you go:\n```json\n" + JSON.stringify(validOutput) + "\n```";
    expect(parseDefensively(wrapped).claimant.name).toBe("Jane Doe");
  });
  it("rejects malformed dates (the break-it path)", () => {
    const bad = { ...validOutput, incidentDate: "13/45/2025" };
    expect(() => parseDefensively(JSON.stringify(bad))).toThrow(ExtractionError);
    expect(() => parseDefensively(JSON.stringify(bad))).toThrow(/incidentDate/);
  });
  it("rejects impossible calendar dates", () => {
    const bad = { ...validOutput, incidentDate: "2026-13-45" };
    expect(() => parseDefensively(JSON.stringify(bad))).toThrow(ExtractionError);
  });
  it("rejects non-JSON", () => {
    expect(() => parseDefensively("I'm sorry, I can't help with that.")).toThrow(
      ExtractionError
    );
  });
});

describe("computeSOL", () => {
  it("computes NY motor vehicle at 3 years", () => {
    const sol = computeSOL("2026-01-10", "NY", "motor_vehicle", new Date("2026-08-10"));
    expect(sol.deadlineISO).toBe("2029-01-10");
    expect(sol.daysRemaining).toBeGreaterThan(850);
    expect(sol.basis).toContain("CPLR");
  });
  it("computes NY med-mal at 30 months", () => {
    const sol = computeSOL("2026-01-10", "NY", "medical_malpractice", new Date("2026-08-10"));
    expect(sol.deadlineISO).toBe("2028-07-10");
  });
  it("returns nulls without an incident date", () => {
    const sol = computeSOL(null, "NY", "motor_vehicle");
    expect(sol.deadlineISO).toBeNull();
    expect(sol.basis).toMatch(/incident date/i);
  });
  it("returns nulls for unknown jurisdiction/case type", () => {
    expect(computeSOL("2026-01-10", null, "motor_vehicle").deadlineISO).toBeNull();
    expect(computeSOL("2026-01-10", "NY", "not_a_case").deadlineISO).toBeNull();
  });
});

describe("matchConflicts", () => {
  const parties = [{ name: "Marcus Whitfield", relationship: "Current client" }];
  it("matches names in extracted fields", () => {
    const out = { ...validOutput, otherPartyInfo: { ...validOutput.otherPartyInfo, name: "Marcus Whitfield" } };
    expect(matchConflicts(out, "", parties)).toHaveLength(1);
  });
  it("matches accented/odd-cased names in raw text", () => {
    expect(matchConflicts(validOutput, "the owner is MÁRCUS   WHITFIELD.", parties)).toHaveLength(1);
  });
  it("passes clean leads", () => {
    expect(matchConflicts(validOutput, "no conflicts here", parties)).toHaveLength(0);
  });
});

describe("buildCaseFile trust boundary", () => {
  it("forces human review on sign_now", () => {
    const { caseFile } = buildCaseFile(validOutput, "", []);
    expect(caseFile.needsHumanReview).toBe(true); // routing is sign_now
  });
  it("forces human review on low confidence", () => {
    const out: ModelOutput = { ...validOutput, routing: "nurture", confidence: 0.5, needsHumanReview: false };
    expect(buildCaseFile(out, "", []).caseFile.needsHumanReview).toBe(true);
  });
  it("forces human review + flags on conflict", () => {
    const out: ModelOutput = { ...validOutput, routing: "nurture", needsHumanReview: false };
    const { caseFile } = buildCaseFile(out, "Marcus Whitfield bit me", [
      { name: "Marcus Whitfield", relationship: "Current client" },
    ]);
    expect(caseFile.conflictFlags).toHaveLength(1);
    expect(caseFile.needsHumanReview).toBe(true);
  });
  it("overwrites any model-supplied SOL with table math", () => {
    const { caseFile } = buildCaseFile(validOutput, "", []);
    expect(caseFile.statuteOfLimitations.deadlineISO).toBe("2029-08-01");
  });
});

describe("resolveReplyDestination", () => {
  const lead = (channel: string, from: string): LeadRow =>
    ({ channel, fromAddress: from }) as LeadRow;
  it("prefers the extracted phone for voicemail", () => {
    const d = resolveReplyDestination(lead("voicemail", "+13475550999"), validOutput as never);
    expect(d?.to).toBe("(347) 555-0100");
  });
  it("falls back to caller ID", () => {
    const out = { ...validOutput, claimant: { ...validOutput.claimant, phone: null } };
    const d = resolveReplyDestination(lead("sms", "+13475550999"), out as never);
    expect(d?.to).toBe("+13475550999");
  });
  it("webform with only email goes to email", () => {
    const out = {
      ...validOutput,
      claimant: { ...validOutput.claimant, phone: null, email: "j@x.com" },
    };
    const d = resolveReplyDestination(lead("webform", "webform"), out as never);
    expect(d?.channel).toBe("webform");
    expect(d?.to).toBe("j@x.com");
  });
  it("webform with only a phone falls back to SMS", () => {
    const d = resolveReplyDestination(lead("webform", "webform"), validOutput as never);
    expect(d?.channel).toBe("sms");
  });
  it("returns null when unreachable", () => {
    const out = { ...validOutput, claimant: { ...validOutput.claimant, phone: null, email: null } };
    expect(resolveReplyDestination(lead("webform", "webform"), out as never)).toBeNull();
  });
});

describe("firmBillingState", async () => {
  const { firmBillingState } = await import("../lib/billing");
  const firm = (over: Record<string, unknown>) =>
    ({ subscriptionStatus: null, trialEndsAt: null, ...over }) as never;
  it("is free when Stripe is not configured", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(firmBillingState(firm({})).kind).toBe("free");
  });
  it("tracks trial, active, past_due, blocked when configured", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_PRICE_ID = "price_x";
    const inTrial = firm({ trialEndsAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });
    expect(firmBillingState(inTrial)).toMatchObject({ kind: "trialing", daysLeft: 3 });
    expect(firmBillingState(firm({ subscriptionStatus: "active" })).kind).toBe("active");
    expect(firmBillingState(firm({ subscriptionStatus: "past_due" }))).toMatchObject({
      kind: "active",
      pastDue: true,
    });
    const expired = firm({ trialEndsAt: new Date(Date.now() - 86_400_000).toISOString() });
    expect(firmBillingState(expired).kind).toBe("blocked");
    expect(firmBillingState(firm({ subscriptionStatus: "canceled" })).kind).toBe("blocked");
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Immigration practice area. All dates are relative to a fixed NOW so the
// deadline arithmetic is deterministic.
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-24T00:00:00Z");
const FIRM = "Ortiz Immigration Law";

const immOutput: ImmigrationModelOutput = {
  caseType: "family_based",
  applicant: {
    name: "Maria Lopez",
    phone: "(212) 555-0101",
    email: null,
    preferredLanguage: "es",
    countryOfCitizenship: "Mexico",
  },
  currentStatus: "pending_application",
  currentStatusDetail: null,
  statusExpirationDate: null,
  lastEntryDate: null,
  petitionerOrSponsor: { name: "Carlos Lopez", relationship: "family_member" },
  namedParties: [],
  pendingFiling: { formType: "I-130", receiptNumber: null, filedDate: null },
  noticeReceived: { type: "none", noticeDate: null },
  removal: {
    inRemovalProceedings: false,
    nextHearingDate: null,
    ijDecisionDate: null,
    isDetained: false,
  },
  priorRepresentation: false,
  priorityScore: 60,
  scoreRationale: "Family petition pending; wants an update.",
  routing: "schedule_consult",
  missingInfo: ["Best time to call"],
  confidence: 0.9,
  needsHumanReview: false,
  draftReply: "Hola Maria, recibimos su mensaje.",
};

function imm(over: Partial<ImmigrationModelOutput>): ImmigrationModelOutput {
  return { ...immOutput, ...over };
}
function withRemoval(r: Partial<ImmigrationModelOutput["removal"]>): ImmigrationModelOutput {
  return imm({ removal: { ...immOutput.removal, ...r } });
}
function withNotice(type: ImmigrationModelOutput["noticeReceived"]["type"], noticeDate: string | null) {
  return imm({ noticeReceived: { type, noticeDate } });
}
const build = (o: ImmigrationModelOutput, raw = "", parties: { name: string; relationship: string }[] = [], extra = {}) =>
  buildImmigrationCaseFile(o, raw, parties, { firmName: FIRM, now: NOW, ...extra });

const triggers = (over: Partial<ImmigrationTriggers> = {}): ImmigrationTriggers => ({
  caseType: "family_based",
  currentStatus: "unknown",
  statusExpirationDate: null,
  lastEntryDate: null,
  noticeType: "none",
  noticeDate: null,
  inRemovalProceedings: false,
  nextHearingDate: null,
  ijDecisionDate: null,
  ...over,
});

describe("parseImmigrationDefensively", () => {
  it("parses clean JSON", () => {
    expect(parseImmigrationDefensively(JSON.stringify(immOutput)).caseType).toBe("family_based");
  });
  it("strips fences and preamble", () => {
    const wrapped = "Here you go:\n```json\n" + JSON.stringify(immOutput) + "\n```";
    expect(parseImmigrationDefensively(wrapped).applicant.name).toBe("Maria Lopez");
  });
  it("rejects a malformed trigger date", () => {
    const bad = withNotice("rfe", "13/45/2025");
    expect(() => parseImmigrationDefensively(JSON.stringify(bad))).toThrow(ExtractionError);
    expect(() => parseImmigrationDefensively(JSON.stringify(bad))).toThrow(/noticeDate/);
  });
  it("rejects an impossible calendar date", () => {
    const bad = imm({ statusExpirationDate: "2026-13-45" });
    expect(() => parseImmigrationDefensively(JSON.stringify(bad))).toThrow(ExtractionError);
  });
  it("rejects an unknown enum value", () => {
    const bad = { ...immOutput, caseType: "motor_vehicle" };
    expect(() => parseImmigrationDefensively(JSON.stringify(bad))).toThrow(/caseType/);
  });
  it("rejects a missing required block", () => {
    const { removal: _removal, ...rest } = immOutput;
    void _removal;
    expect(() => parseImmigrationDefensively(JSON.stringify(rest))).toThrow(/removal/);
  });
  it("rejects a PI-shaped response", () => {
    expect(() => parseImmigrationDefensively(JSON.stringify(validOutput))).toThrow(ExtractionError);
  });
  it("rejects non-JSON", () => {
    expect(() => parseImmigrationDefensively("I can't help with that.")).toThrow(ExtractionError);
  });
  it("drops any deadline the model tries to supply — deadlines are code's", () => {
    const sneaky = {
      ...immOutput,
      deadlines: [{ label: "Hearing", deadlineISO: "2099-01-01" }],
      timeCritical: false,
    };
    const parsed = parseImmigrationDefensively(JSON.stringify(sneaky)) as Record<string, unknown>;
    expect(parsed.deadlines).toBeUndefined();
    expect(parsed.timeCritical).toBeUndefined();
  });
});

describe("computeImmigrationDeadlines", () => {
  it("computes an RFE response window and documents the mailing allowance separately", () => {
    const { deadlines, soonest } = computeImmigrationDeadlines(
      triggers({ noticeType: "rfe", noticeDate: "2026-09-01" }),
      NOW
    );
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0]).toMatchObject({
      trigger: "rfe",
      kind: "computed",
      deadlineISO: "2026-11-24", // 84 days, NOT 87
      mailingAllowanceDays: IMMIGRATION_RULES.rfe.mailingAllowanceDays,
    });
    expect(deadlines[0].basis).toMatch(/illustrative; verify/);
    expect(soonest?.trigger).toBe("rfe");
  });
  it("says what's missing for an RFE with no notice date instead of guessing", () => {
    const { deadlines, soonest } = computeImmigrationDeadlines(triggers({ noticeType: "rfe" }), NOW);
    expect(deadlines[0]).toMatchObject({ kind: "needs_trigger", deadlineISO: null, daysRemaining: null });
    expect(deadlines[0].basis).toMatch(/Cannot compute — needs the RFE notice date/);
    expect(soonest).toBeNull();
  });
  it("computes a NOID response window (30 days) and flags a missing date", () => {
    const ok = computeImmigrationDeadlines(triggers({ noticeType: "noid", noticeDate: "2026-09-01" }), NOW);
    expect(ok.deadlines[0].deadlineISO).toBe("2026-10-01");
    const missing = computeImmigrationDeadlines(triggers({ noticeType: "noid" }), NOW);
    expect(missing.deadlines[0].basis).toMatch(/needs the NOID notice date/);
  });
  it("computes the BIA appeal (30 days) and motion to reopen (90 days) from the IJ decision", () => {
    const { deadlines } = computeImmigrationDeadlines(triggers({ ijDecisionDate: "2026-09-10" }), NOW);
    const bia = deadlines.find((d) => d.trigger === "bia_appeal");
    const mtr = deadlines.find((d) => d.trigger === "motion_to_reopen");
    expect(bia?.deadlineISO).toBe("2026-10-10");
    expect(mtr?.deadlineISO).toBe("2026-12-09");
  });
  it("emits no BIA/MTR entry without an IJ decision date", () => {
    const { deadlines } = computeImmigrationDeadlines(triggers({ inRemovalProceedings: false }), NOW);
    expect(deadlines.some((d) => d.trigger === "bia_appeal")).toBe(false);
  });
  it("computes the asylum one-year bar from last entry, and flags a missing entry date", () => {
    const ok = computeImmigrationDeadlines(
      triggers({ caseType: "asylum_humanitarian", lastEntryDate: "2026-03-15" }),
      NOW
    );
    expect(ok.deadlines[0]).toMatchObject({ trigger: "asylum_one_year", deadlineISO: "2027-03-15" });
    const missing = computeImmigrationDeadlines(triggers({ caseType: "asylum_humanitarian" }), NOW);
    expect(missing.deadlines[0].basis).toMatch(/needs the date of last arrival/);
    // not an asylum matter: no asylum rule at all
    expect(computeImmigrationDeadlines(triggers({ lastEntryDate: "2026-03-15" }), NOW).deadlines).toHaveLength(0);
  });
  it("uses the status expiration and hearing dates themselves, with no arithmetic", () => {
    const { deadlines } = computeImmigrationDeadlines(
      triggers({ statusExpirationDate: "2026-12-01", nextHearingDate: "2026-11-05", inRemovalProceedings: true }),
      NOW
    );
    expect(deadlines.find((d) => d.trigger === "status_expiration")?.deadlineISO).toBe("2026-12-01");
    expect(deadlines.find((d) => d.trigger === "hearing")?.deadlineISO).toBe("2026-11-05");
  });
  it("flags a missing status-expiration date for a visa holder, and a missing hearing date in proceedings", () => {
    const { deadlines } = computeImmigrationDeadlines(
      triggers({ currentStatus: "visa_holder", inRemovalProceedings: true }),
      NOW
    );
    expect(deadlines.map((d) => d.basis).join("|")).toMatch(/status expiration date.*next hearing date/);
    expect(deadlines.every((d) => d.kind === "needs_trigger")).toBe(true);
  });
  it("sorts soonest first, with cannot-compute entries last, and exposes soonest", () => {
    const { deadlines, soonest } = computeImmigrationDeadlines(
      triggers({
        noticeType: "rfe",
        noticeDate: "2026-09-01", // 2026-11-24
        nextHearingDate: "2026-10-05",
        inRemovalProceedings: true,
        currentStatus: "visa_holder", // needs status expiration
        statusExpirationDate: null,
      }),
      NOW
    );
    expect(deadlines.map((d) => d.trigger)).toEqual(["hearing", "rfe", "status_expiration"]);
    expect(soonest?.trigger).toBe("hearing");
  });
  it("reports a negative daysRemaining once a deadline has passed", () => {
    const { deadlines } = computeImmigrationDeadlines(triggers({ nextHearingDate: "2026-09-20" }), NOW);
    expect(deadlines[0].daysRemaining).toBe(-4);
  });
  it("returns nothing for a lead with no trigger facts", () => {
    const r = computeImmigrationDeadlines(triggers(), NOW);
    expect(r.deadlines).toEqual([]);
    expect(r.soonest).toBeNull();
  });
});

describe("computeTimeCritical", () => {
  const base = { isDetained: false as boolean | "unknown", nextHearingDate: null, noticeType: "none" as const, deadlines: [] };
  it("fires when the person is detained", () => {
    const r = computeTimeCritical({ ...base, isDetained: true }, NOW);
    expect(r.timeCritical).toBe(true);
    expect(r.reasons).toContain("Person may be detained");
  });
  it("does not fire on 'unknown' detention alone", () => {
    expect(computeTimeCritical({ ...base, isDetained: "unknown" }, NOW).timeCritical).toBe(false);
  });
  it("fires for a hearing in 10 days, at the 14-day edge, and when already passed", () => {
    expect(computeTimeCritical({ ...base, nextHearingDate: "2026-10-04" }, NOW).timeCritical).toBe(true);
    expect(computeTimeCritical({ ...base, nextHearingDate: "2026-10-08" }, NOW).timeCritical).toBe(true); // 14 days
    expect(computeTimeCritical({ ...base, nextHearingDate: "2026-09-01" }, NOW).timeCritical).toBe(true);
  });
  it("does not fire for a hearing 60 days out", () => {
    expect(computeTimeCritical({ ...base, nextHearingDate: "2026-11-23" }, NOW).timeCritical).toBe(false);
  });
  it("fires for a past-due computed deadline and a deadline within 14 days", () => {
    const past = computeImmigrationDeadlines(triggers({ noticeType: "rfe", noticeDate: "2026-05-01" }), NOW);
    expect(past.deadlines[0].daysRemaining).toBeLessThan(0);
    expect(computeTimeCritical({ ...base, noticeType: "rfe", deadlines: past.deadlines }, NOW).timeCritical).toBe(true);
    const soon = computeImmigrationDeadlines(triggers({ ijDecisionDate: "2026-09-10" }), NOW); // BIA 2026-10-10 = 16 days
    expect(computeTimeCritical({ ...base, deadlines: soon.deadlines }, NOW).timeCritical).toBe(false);
    const closer = computeImmigrationDeadlines(triggers({ ijDecisionDate: "2026-09-01" }), NOW); // BIA 2026-10-01 = 7 days
    expect(computeTimeCritical({ ...base, deadlines: closer.deadlines }, NOW).timeCritical).toBe(true);
  });
  it("fires for a Notice to Appear with no known hearing date, not once a date is known and far", () => {
    expect(computeTimeCritical({ ...base, noticeType: "nta" }, NOW).timeCritical).toBe(true);
    expect(computeTimeCritical({ ...base, noticeType: "nta", nextHearingDate: "2027-03-01" }, NOW).timeCritical).toBe(false);
  });
  it("never puts a date or a day count in the reasons", () => {
    const r = computeTimeCritical({ ...base, isDetained: true, nextHearingDate: "2026-10-04" }, NOW);
    expect(r.reasons.join(" ")).not.toMatch(/\d{4}-\d{2}-\d{2}|\bdays? left\b/);
  });
  it("stays quiet for an ordinary lead", () => {
    expect(computeTimeCritical(base, NOW)).toEqual({ timeCritical: false, reasons: [] });
  });
});

describe("buildImmigrationCaseFile trust boundary", () => {
  it("marks a detained lead time-critical, forces review, and never leaves it declined or nurtured", () => {
    for (const routing of ["decline", "nurture"] as const) {
      const { caseFile } = build(withRemoval({ isDetained: true }), "", [], {});
      const out = build({ ...withRemoval({ isDetained: true }), routing }).caseFile;
      expect(out.timeCritical).toBe(true);
      expect(out.needsHumanReview).toBe(true);
      expect(out.routing).toBe("schedule_consult");
      expect(caseFile.timeCritical).toBe(true);
    }
  });
  it("keeps sign_now on a time-critical lead", () => {
    const { caseFile } = build({ ...withRemoval({ isDetained: true }), routing: "sign_now" });
    expect(caseFile.routing).toBe("sign_now");
  });
  it("replaces the model's draft with a brief code-written acknowledgment in the sender's language", () => {
    const es = build(withRemoval({ isDetained: true }));
    expect(es.draftReply).toBe(timeCriticalAckFor("es", FIRM));
    expect(es.draftReply).not.toBe(immOutput.draftReply);
    expect(es.draftReply).toMatch(/911/);
    const en = build({ ...withRemoval({ isDetained: true }), applicant: { ...immOutput.applicant, preferredLanguage: "en" } });
    expect(en.draftReply).toBe(timeCriticalAckFor("en", FIRM));
    expect(en.draftReply).toContain(FIRM);
  });
  it("keeps the model's draft and routing for an ordinary lead", () => {
    const { caseFile, draftReply } = build({ ...immOutput, routing: "nurture" });
    expect(caseFile.timeCritical).toBe(false);
    expect(caseFile.routing).toBe("nurture");
    expect(draftReply).toBe(immOutput.draftReply);
  });
  it("forces human review on sign_now and on low confidence", () => {
    expect(build({ ...immOutput, routing: "sign_now" }).caseFile.needsHumanReview).toBe(true);
    expect(build({ ...immOutput, confidence: 0.5 }).caseFile.needsHumanReview).toBe(true);
    expect(build(immOutput).caseFile.needsHumanReview).toBe(false);
  });
  it("flags a conflict on the petitioner's name and holds for review", () => {
    const { caseFile } = build(immOutput, "", [{ name: "Carlos Lopez", relationship: "Current client" }]);
    expect(caseFile.conflictFlags).toEqual(["Carlos Lopez — Current client"]);
    expect(caseFile.needsHumanReview).toBe(true);
  });
  it("flags a conflict on a named employer or family member, and in the raw text", () => {
    const named = build(imm({ namedParties: ["Acme Staffing"] }), "", [{ name: "Acme Staffing", relationship: "Adverse party" }]);
    expect(named.caseFile.conflictFlags).toHaveLength(1);
    const raw = build(immOutput, "my cousin Pedro Ruiz filed it", [{ name: "Pedro Ruiz", relationship: "Current client" }]);
    expect(raw.caseFile.conflictFlags).toHaveLength(1);
  });
  it("passes a clean lead", () => {
    expect(build(immOutput, "nothing here", [{ name: "Someone Else", relationship: "Client" }]).caseFile.conflictFlags).toEqual([]);
  });
  it("lets the form's 'someone is detained' answer trigger time-critical even if the model missed it", () => {
    expect(build(immOutput, "", [], { formDetained: true }).caseFile.timeCritical).toBe(true);
    expect(build(withRemoval({ isDetained: "unknown" }), "", [], { formDetained: true }).caseFile.removal.isDetained).toBe(true);
  });
  it("never lets the form's answer downgrade a model that saw detention", () => {
    expect(build(withRemoval({ isDetained: true }), "", [], { formDetained: undefined }).caseFile.timeCritical).toBe(true);
  });
  it("attaches computed deadlines and the soonest one to the case file", () => {
    const { caseFile } = build(withNotice("rfe", "2026-09-01"));
    expect(caseFile.practiceArea).toBe("immigration");
    expect(caseFile.deadlines[0].deadlineISO).toBe("2026-11-24");
    expect(caseFile.soonestDeadline?.trigger).toBe("rfe");
  });
});

describe("case-file helpers and guardrails, per practice area", () => {
  it("treats a case file with no practiceArea as personal injury", () => {
    const pi = buildCaseFile(validOutput, "", []).caseFile;
    expect(pi.practiceArea).toBeUndefined();
    expect(isImmigrationCaseFile(pi)).toBe(false);
    expect(practiceAreaOf(pi)).toBe("personal_injury");
    expect(contactOf(pi).name).toBe("Jane Doe");
  });
  it("reads the applicant for immigration", () => {
    const cf = build(immOutput).caseFile;
    expect(practiceAreaOf(cf)).toBe("immigration");
    expect(contactOf(cf)).toMatchObject({ name: "Maria Lopez", phone: "(212) 555-0101", preferredLanguage: "es" });
  });
  it("routes reply destinations off an immigration applicant's contact", () => {
    const cf = build(immOutput).caseFile;
    const d = resolveReplyDestination({ channel: "sms", fromAddress: "+12125550000" } as LeadRow, cf);
    expect(d?.to).toBe("(212) 555-0101");
  });
  it("PI: only sign_now is high priority", () => {
    const sign = buildCaseFile(validOutput, "", []).caseFile;
    expect(isHighPriority(sign)).toBe(true);
    expect(isHighPriority(buildCaseFile({ ...validOutput, routing: "nurture" }, "", []).caseFile)).toBe(false);
  });
  it("immigration: time-critical is high priority even when routed to consult", () => {
    const cf = build(withRemoval({ isDetained: true })).caseFile;
    expect(cf.routing).toBe("schedule_consult");
    expect(isHighPriority(cf)).toBe(true);
    expect(isHighPriority(build(immOutput).caseFile)).toBe(false);
  });
  it("PI conduct rules and disclaimer are unchanged by default", () => {
    expect(conductRules("Acme Injury Law")).toBe(CONDUCT_RULES_TEMPLATE.replaceAll("{{FIRM}}", "Acme Injury Law"));
    expect(conductRules("Acme", "personal_injury")).toBe(conductRules("Acme"));
    expect(disclaimerFor("en", "Acme")).toBe(disclaimerFor("en", "Acme", "personal_injury"));
    expect(disclaimerFor("en", "Acme")).not.toMatch(/represent you/);
  });
  it("immigration conduct rules carry the required never-do list and the injection paragraph", () => {
    // Collapse the template's hard line wraps so phrases can span them.
    const rules = conductRules(FIRM, "immigration").replace(/\s+/g, " ");
    for (const phrase of [
      "give legal advice",
      "predict eligibility",
      "processing times",
      "whether to file, travel, leave the country, or attend or skip a hearing",
      "immigration status as a legal conclusion",
      "A-number, passport number, Social Security",
      "attorney-client relationship",
      "unauthorized practice of immigration law",
      "compute or state any deadline",
      "untrusted input",
    ]) {
      expect(rules).toContain(phrase);
    }
    expect(rules).toContain(FIRM);
    expect(rules).not.toContain("statute-of-limitations");
  });
  it("immigration disclaimers exist in en and es and differ from personal injury's", () => {
    expect(disclaimerFor("en", FIRM, "immigration")).toMatch(/represent you/);
    expect(disclaimerFor("es", FIRM, "immigration")).toMatch(/representarle/);
    expect(disclaimerFor("es", FIRM, "immigration")).not.toBe(disclaimerFor("es", FIRM));
    expect(disclaimerFor("fr", FIRM, "immigration")).toBe(disclaimerFor("en", FIRM, "immigration")); // falls back
  });
  it("matchNames agrees with matchConflicts for personal injury", () => {
    const parties = [{ name: "Marcus Whitfield", relationship: "Current client" }];
    const out = { ...validOutput, otherPartyInfo: { ...validOutput.otherPartyInfo, name: "Marcus Whitfield" } };
    expect(matchNames([out.otherPartyInfo.name, out.claimant.name], "", parties)).toEqual(
      matchConflicts(out, "", parties)
    );
  });
});

describe("leadUrgency with time-critical", () => {
  const justNow = new Date(NOW.getTime() - 60_000).toISOString();
  it("is red immediately for a time-critical lead that still needs eyes", () => {
    expect(leadUrgency({ needsEyes: true, receivedAt: justNow, routing: "schedule_consult", timeCritical: true, now: NOW })).toBe("red");
  });
  it("is not urgent once answered, even if it was time-critical", () => {
    expect(leadUrgency({ needsEyes: false, receivedAt: justNow, routing: "schedule_consult", timeCritical: true, now: NOW })).toBe("none");
  });
  it("leaves personal-injury urgency unchanged", () => {
    const twentyMin = new Date(NOW.getTime() - 20 * 60_000).toISOString();
    expect(leadUrgency({ needsEyes: true, receivedAt: twentyMin, routing: "sign_now", now: NOW })).toBe("amber");
    expect(leadUrgency({ needsEyes: true, receivedAt: justNow, routing: "nurture", now: NOW })).toBe("none");
  });
});

describe("GoHighLevel note honours the deadline-acknowledgment gate", () => {
  const baseInput = { leadId: "L1", channel: "webform", fromAddress: "x@y.com", displayName: null, raw: "raw", firmName: "Firm" };
  it("personal injury: no SOL line until acknowledged, SOL line once it is", () => {
    const caseFile = buildCaseFile(validOutput, "", []).caseFile;
    expect(noteBody({ ...baseInput, caseFile, deadlinesVisible: false })).not.toMatch(/SOL:/);
    expect(noteBody({ ...baseInput, caseFile, deadlinesVisible: true })).toMatch(/SOL:\s+2029-08-01/);
    // a caller that doesn't say keeps the old behaviour (visible)
    expect(noteBody({ ...baseInput, caseFile })).toMatch(/SOL:\s+2029-08-01/);
  });
  it("immigration: no computed deadline until acknowledged, but time-critical still shows", () => {
    const caseFile = build({
      ...withNotice("rfe", "2026-09-01"),
      removal: { ...immOutput.removal, isDetained: true },
    }).caseFile;
    const hidden = noteBody({ ...baseInput, caseFile, deadlinesVisible: false });
    expect(hidden).not.toMatch(/Deadline:/);
    expect(hidden).toMatch(/TIME-CRITICAL: Person may be detained/);
    expect(noteBody({ ...baseInput, caseFile, deadlinesVisible: true })).toMatch(/Deadline:\s+Response to Request for Evidence — 2026-11-24/);
  });
});

describe("staff-facing text (immigration)", () => {
  it("tells the model to write staff-facing fields in English and keep the status detail short", () => {
    const system = immigrationExtractor({} as never, FIRM).system("2026-09-26").replace(/\s+/g, " ");
    expect(system).toMatch(/Write scoreRationale, missingInfo, and currentStatusDetail in ENGLISH/);
    expect(system).toMatch(/Only draftReply follows the sender's language/);
    expect(system).toMatch(/SHORT label only/);
    expect(system).toMatch(/40 characters at most/);
    expect(system).toMatch(/Never a sentence/);
  });
  it("splits a short status detail inline and a long one into a note, never dropping it", () => {
    expect(splitStatusDetail("F-1")).toEqual({ inline: "F-1", note: null });
    expect(splitStatusDetail("  expired visitor visa ")).toEqual({ inline: "expired visitor visa", note: null });
    const long = "The sender's brother was arrested by immigration officers this morning and taken to a detention center.";
    expect(splitStatusDetail(long)).toEqual({ inline: null, note: long });
    expect(splitStatusDetail("x".repeat(40)).inline).toHaveLength(40);
    expect(splitStatusDetail("x".repeat(41)).inline).toBeNull();
    expect(splitStatusDetail(null)).toEqual({ inline: null, note: null });
    expect(splitStatusDetail("   ")).toEqual({ inline: null, note: null });
  });
  it("replaces the routing line with 'call now' for time-critical leads only", () => {
    const line = "Strong case — call first thing and send the retainer";
    const critical = build(withRemoval({ isDetained: true }), "", [], {}).caseFile;
    expect(guidanceSentence(critical, line)).toBe("Time-critical — call now, do not wait for morning");
    expect(guidanceSentence(build(immOutput).caseFile, line)).toBe(line);
    // personal injury is untouched
    expect(guidanceSentence(buildCaseFile(validOutput, "", []).caseFile, line)).toBe(line);
  });
});
