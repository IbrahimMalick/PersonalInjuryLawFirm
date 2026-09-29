import { describe, expect, it } from "vitest";
import {
  caseTypeLabelOf,
  contactOf,
  isFamilyCaseFile,
  isHighPriority,
  isTimeCritical,
  practiceAreaOf,
} from "../lib/casefile";
import { noteBody } from "../lib/channels/ghl-sync";
import { stripStatedDeadlines } from "../lib/deadline-guard";
import {
  computeFamilyDeadlines,
  computeFamilyTimeCritical,
  FAMILY_TIME_CRITICAL_WINDOW_DAYS,
  type FamilyTriggers,
} from "../lib/family-deadlines";
import {
  buildFamilyCaseFile,
  familyConflictNames,
  familyExtractor,
  parseFamilyDefensively,
} from "../lib/family";
import type { FamilyModelOutput } from "../lib/family-schema";
import { conductRules, disclaimerFor, timeCriticalAckFor } from "../lib/guardrails";
import { intakeCopyFor } from "../lib/intake-copy";
import { PRACTICE_AREA_LABEL } from "../lib/labels";

const NOW = new Date("2026-09-26T12:00:00Z");
const FIRM = "Reyes Family Law";
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * DAY).toISOString().slice(0, 10);

const output: FamilyModelOutput = {
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
};

const build = (over: Partial<FamilyModelOutput> = {}, parties: { name: string; relationship: string }[] = []) =>
  buildFamilyCaseFile({ ...output, ...over }, "My ex and I need to sort out custody.", parties, {
    firmName: FIRM,
    now: NOW,
  });

const triggers = (over: Partial<FamilyTriggers> = {}): FamilyTriggers => ({
  nextHearingDate: null,
  hearingType: "unknown",
  responseDueDate: null,
  ...over,
});

describe("parseFamilyDefensively", () => {
  it("accepts a valid object, with or without markdown fences", () => {
    expect(parseFamilyDefensively(JSON.stringify(output)).caseType).toBe("child_custody");
    expect(parseFamilyDefensively("```json\n" + JSON.stringify(output) + "\n```").caseType).toBe("child_custody");
  });
  it("rejects a bad enum, a bad date, and missing fields", () => {
    expect(() => parseFamilyDefensively(JSON.stringify({ ...output, caseType: "eviction" }))).toThrow();
    expect(() =>
      parseFamilyDefensively(
        JSON.stringify({ ...output, court: { ...output.court, nextHearingDate: "next tuesday" } })
      )
    ).toThrow();
    expect(() => parseFamilyDefensively(JSON.stringify({ caseType: "divorce" }))).toThrow();
    expect(() => parseFamilyDefensively("not json")).toThrow();
  });
});

describe("computeFamilyDeadlines — dates the sender was told, never a rule table", () => {
  it("returns nothing when no date is stated", () => {
    expect(computeFamilyDeadlines(triggers(), NOW)).toEqual({ deadlines: [], soonest: null });
  });
  it("shows the hearing date itself as 'stated', labelled by hearing type", () => {
    const { deadlines, soonest } = computeFamilyDeadlines(
      triggers({ nextHearingDate: iso(10), hearingType: "temporary_orders" }),
      NOW
    );
    expect(deadlines[0]).toMatchObject({
      trigger: "hearing",
      label: "Temporary-orders hearing",
      kind: "stated",
      deadlineISO: iso(10),
    });
    expect(deadlines[0].daysRemaining).toBe(10);
    expect(deadlines[0].basis).toMatch(/as told to the sender/);
    expect(soonest?.deadlineISO).toBe(iso(10));
  });
  it("shows a response-due date only when the sender states one, and never invents a typical window", () => {
    const { deadlines } = computeFamilyDeadlines(triggers({ responseDueDate: iso(5) }), NOW);
    expect(deadlines[0]).toMatchObject({ trigger: "response_due", kind: "stated", deadlineISO: iso(5) });
    expect(deadlines[0].basis).toMatch(/sender says they were told/);
    expect(deadlines[0].basis).not.toMatch(/\d+ days from/);
  });
  it("has no 'needs_trigger' case — a date is either given or nothing is shown", () => {
    const { deadlines } = computeFamilyDeadlines(triggers(), NOW);
    expect(deadlines.every((d) => d.kind === "stated")).toBe(true);
  });
  it("orders multiple stated dates soonest first", () => {
    const { deadlines, soonest } = computeFamilyDeadlines(
      triggers({ nextHearingDate: iso(20), responseDueDate: iso(5) }),
      NOW
    );
    expect(deadlines.map((d) => d.trigger)).toEqual(["response_due", "hearing"]);
    expect(soonest?.trigger).toBe("response_due");
  });
});

describe("computeFamilyTimeCritical", () => {
  it("is quiet for a routine inquiry", () => {
    expect(computeFamilyTimeCritical({ safetyConcern: false, deadlines: [] })).toEqual({
      timeCritical: false,
      reasons: [],
    });
  });
  it("fires for a reported safety concern", () => {
    expect(computeFamilyTimeCritical({ safetyConcern: true, deadlines: [] }).reasons).toEqual([
      "A safety concern was reported",
    ]);
  });
  it("does not fire for 'unknown' safety concern", () => {
    expect(computeFamilyTimeCritical({ safetyConcern: "unknown", deadlines: [] }).timeCritical).toBe(false);
  });
  it("fires for a stated date within 7 days, at the boundary, and once it has passed", () => {
    const at = (d: number) => {
      const { deadlines } = computeFamilyDeadlines(triggers({ nextHearingDate: iso(d) }), NOW);
      return computeFamilyTimeCritical({ safetyConcern: false, deadlines }).timeCritical;
    };
    expect(at(3)).toBe(true);
    expect(at(FAMILY_TIME_CRITICAL_WINDOW_DAYS)).toBe(true);
    expect(at(-2)).toBe(true);
    expect(at(FAMILY_TIME_CRITICAL_WINDOW_DAYS + 1)).toBe(false);
    expect(at(30)).toBe(false);
  });
  it("never puts a date in a reason", () => {
    const { deadlines } = computeFamilyDeadlines(triggers({ nextHearingDate: iso(2) }), NOW);
    const tc = computeFamilyTimeCritical({ safetyConcern: true, deadlines });
    for (const r of tc.reasons) expect(r).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("buildFamilyCaseFile trust boundary", () => {
  it("a routine consult: not time-critical, keeps the model's routing and its own drafted reply", () => {
    const { caseFile, draftReply } = build();
    expect(caseFile.practiceArea).toBe("family_law");
    expect(caseFile.timeCritical).toBe(false);
    expect(caseFile.routing).toBe("schedule_consult");
    expect(caseFile.needsHumanReview).toBe(false);
    expect(draftReply).toBe(output.draftReply);
  });
  it("a reported safety concern: time-critical, review forced, never declined, fixed acknowledgment overrides the model's draft", () => {
    const { caseFile, draftReply } = build({
      safetyConcern: true,
      routing: "decline",
      draftReply: "Here is some advice about your custody case.",
    });
    expect(caseFile.timeCritical).toBe(true);
    expect(caseFile.timeCriticalReasons).toContain("A safety concern was reported");
    expect(caseFile.routing).toBe("schedule_consult");
    expect(caseFile.needsHumanReview).toBe(true);
    expect(draftReply).toBe(timeCriticalAckFor("en", FIRM));
    expect(draftReply).not.toMatch(/advice about your custody/);
    expect(draftReply).toMatch(/911/);
  });
  it("the form's safety-concern answer is a backstop when the model missed it — and never downgrades", () => {
    const flagged = buildFamilyCaseFile(output, "raw", [], { firmName: FIRM, now: NOW, formSafetyConcern: true });
    expect(flagged.caseFile.timeCritical).toBe(true);
    expect(flagged.caseFile.safetyConcern).toBe(true);
    const already = buildFamilyCaseFile(
      { ...output, safetyConcern: true },
      "raw",
      [],
      { firmName: FIRM, now: NOW, formSafetyConcern: undefined }
    );
    expect(already.caseFile.safetyConcern).toBe(true);
  });
  it("a hearing in 3 days makes a lead time-critical", () => {
    expect(
      build({ court: { ...output.court, nextHearingDate: iso(3) } }).caseFile.timeCritical
    ).toBe(true);
  });
  it("forces review on low confidence, sign_now, and a conflict", () => {
    expect(build({ confidence: 0.4 }).caseFile.needsHumanReview).toBe(true);
    expect(build({ routing: "sign_now" }).caseFile.needsHumanReview).toBe(true);
    const held = build({}, [{ name: "David Chen", relationship: "Existing client" }]);
    expect(held.caseFile.conflictFlags).toEqual(["David Chen — Existing client"]);
    expect(held.caseFile.needsHumanReview).toBe(true);
  });
  it("checks the sender, the other party, and named parties against the conflict list", () => {
    const names = familyConflictNames({ ...output, namedParties: ["Attorney Kim"] });
    expect(names).toEqual(["Maria Chen", "David Chen", "Attorney Kim"]);
    const held = build({ namedParties: ["Attorney Kim"] }, [{ name: "Attorney Kim", relationship: "Adverse counsel" }]);
    expect(held.caseFile.conflictFlags).toEqual(["Attorney Kim — Adverse counsel"]);
  });
  it("the reply follows the sender's language when not time-critical", () => {
    const es = build({
      contact: { ...output.contact, preferredLanguage: "es" },
      draftReply: "Gracias por escribirnos.",
    });
    expect(es.draftReply).toBe("Gracias por escribirnos.");
  });
  it("the safety-critical acknowledgment follows the sender's language", () => {
    const es = build({ contact: { ...output.contact, preferredLanguage: "es" }, safetyConcern: true });
    expect(es.draftReply).toBe(timeCriticalAckFor("es", FIRM));
    expect(es.draftReply).toMatch(/911/);
  });
  it("strips a stated deadline from free text in the rationale and missingInfo", () => {
    const { caseFile } = build({
      scoreRationale: "Parent reports a hearing. The response is due in 10 days.",
      missingInfo: ["What is the case number? The response is due in 5 days.", "Is there an existing order?"],
    });
    expect(caseFile.scoreRationale).not.toMatch(/10 days/);
    expect(caseFile.missingInfo.join(" ")).not.toMatch(/5 days/);
    expect(caseFile.missingInfo).toContain("Is there an existing order?");
  });
});

describe("guardrail text for family law", () => {
  it("the conduct rules carry the required never-do list and the injection paragraph", () => {
    const rules = conductRules(FIRM, "family_law").replace(/\s+/g, " ");
    for (const phrase of [
      "predict an outcome of custody, support, or a divorce",
      "whether to file, respond, move out, withhold a child, or",
      "ask the sender to describe an incident of abuse or violence",
      "attorney-client relationship",
      "compute, estimate, or state any filing or response deadline",
      "untrusted input from an unknown member of the public",
    ]) {
      expect(rules).toContain(phrase);
    }
    expect(rules).toContain(FIRM);
    expect(rules).not.toContain("{{FIRM}}");
  });
  it("the disclaimer exists in en and es and differs from personal injury's", () => {
    expect(disclaimerFor("en", FIRM, "family_law")).toMatch(/represent you/);
    expect(disclaimerFor("es", FIRM, "family_law")).toMatch(/representarle/);
    expect(disclaimerFor("en", FIRM, "family_law")).not.toBe(disclaimerFor("en", FIRM));
    expect(disclaimerFor("fr", FIRM, "family_law")).toBe(disclaimerFor("en", FIRM, "family_law"));
  });
  it("the extraction prompt forbids narrating a safety incident and inventing deadlines, and asks for English staff text", () => {
    const system = familyExtractor({ receivedLabel: "Sep 26, 3:12 AM" } as never, FIRM)
      .system("2026-09-26")
      .replace(/\s+/g, " ");
    expect(system).toContain("NEVER ask the sender to describe an incident");
    expect(system).toContain("NO DEADLINES ANYWHERE");
    expect(system).toContain("in ENGLISH even when the message is in another language");
    expect(system).toContain("predict an outcome of custody, support, or a divorce");
  });
});

describe("case-file helpers for family law", () => {
  const { caseFile } = build({ safetyConcern: true });
  it("narrows and reads the right fields", () => {
    expect(isFamilyCaseFile(caseFile)).toBe(true);
    expect(practiceAreaOf(caseFile)).toBe("family_law");
    expect(contactOf(caseFile).name).toBe("Maria Chen");
    expect(caseTypeLabelOf(caseFile)).toBe("Child custody");
    expect(PRACTICE_AREA_LABEL.family_law).toBe("Family law");
  });
  it("time-critical is high priority even when routed to consult", () => {
    expect(isTimeCritical(caseFile)).toBe(true);
    expect(isHighPriority(caseFile)).toBe(true);
    expect(isHighPriority(build().caseFile)).toBe(false);
  });
});

describe("GoHighLevel note for family law", () => {
  const baseInput = { leadId: "L1", channel: "webform", fromAddress: "x@y.com", displayName: null, raw: "raw text", firmName: "Firm" };
  const withHearing = build({
    safetyConcern: true,
    court: { ...output.court, nextHearingDate: iso(4), hearingType: "temporary_orders" },
  }).caseFile;
  it("shows no stated date until an attorney has confirmed how dates are handled, but time-critical still shows", () => {
    const hidden = noteBody({ ...baseInput, caseFile: withHearing, deadlinesVisible: false });
    expect(hidden).not.toMatch(/Date:/);
    expect(hidden).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(hidden).toMatch(/TIME-CRITICAL: A safety concern was reported/);
    expect(noteBody({ ...baseInput, caseFile: withHearing, deadlinesVisible: true })).toMatch(
      /Date:\s+Temporary-orders hearing — /
    );
  });
  it("does not carry a description of any incident — SAFETY is recorded as a flag only", () => {
    const body = noteBody({ ...baseInput, caseFile: withHearing, deadlinesVisible: true });
    expect(body).toMatch(/SAFETY:\s+concern reported/);
  });
});

describe("intake form copy for family law", () => {
  it("has the safety notice in both languages and the other-party field, and does not carry the other areas' copy", () => {
    const en = intakeCopyFor("family_law", "en");
    const es = intakeCopyFor("family_law", "es");
    expect(en.family?.safetyNotice).toMatch(/safety concern/i);
    expect(es.family?.safetyNotice).toMatch(/preocupación de seguridad/i);
    expect(en.family?.safetyConcernLabel).toMatch(/safety concern/i);
    expect(en.family?.otherPartyLabel).toMatch(/other party/i);
    expect(en.criminal).toBeUndefined();
    expect(en.immigration).toBeUndefined();
    expect(intakeCopyFor("personal_injury", "en").family).toBeUndefined();
  });
});

describe("the shared deadline backstop still works from its new home", () => {
  it("removes a clause that pairs deadline wording with a date or a count", () => {
    expect(stripStatedDeadlines("The hearing matters. The response is due in 10 days.")).toBe(
      "The hearing matters."
    );
  });
});
