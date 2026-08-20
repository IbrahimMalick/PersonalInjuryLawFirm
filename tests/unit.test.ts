import { describe, expect, it } from "vitest";
import { parseDefensively, ExtractionError, buildCaseFile } from "../lib/extract";
import { computeSOL } from "../lib/sol-table";
import { matchConflicts } from "../lib/conflicts";
import { resolveReplyDestination } from "../lib/reply";
import type { LeadRow } from "../lib/db/schema";
import type { ModelOutput } from "../lib/schema";

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
