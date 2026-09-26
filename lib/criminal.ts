import { matchNames, type ConflictParty } from "./conflicts";
import { computeCriminalDeadlines, computeCriminalTimeCritical } from "./criminal-deadlines";
import {
  zCriminalModelOutput,
  type CriminalCaseFile,
  type CriminalModelOutput,
} from "./criminal-schema";
import { stripStatedDeadlines } from "./deadline-guard";
import {
  parseJsonObject,
  validateWith,
  type AreaExtractor,
  type ExtractionInput,
} from "./extract";
import { CRIMINAL_REVIEW_RULES, conductRules, criminalReplyFor } from "./guardrails";

// Criminal-defense intake: the model extracts; code decides deadlines,
// conflicts, time-critical status, forced human review, and the reply. The
// model does not draft a reply and has no field to record what allegedly
// happened. Nothing here sends anything — a person approves every reply.

const OUTPUT_CONTRACT = `
Today's date is {{TODAY}}. Resolve relative dates ("last night", "next Tuesday")
against it. The message below arrived at the firm at {{RECEIVED}}.

Respond with ONLY a single JSON object — no preamble, no markdown fences, no
commentary. Schema (all fields required; use null where unknown):

{
  "caseType": "dui_dwi" | "drug" | "assault_violence" | "domestic_violence" | "theft_property" | "weapons" | "traffic" | "probation_violation" | "juvenile" | "white_collar" | "other" | "not_a_case",
  "contact": { "name": string|null, "phone": string|null, "email": string|null, "preferredLanguage": string|null },
  "writerRole": "defendant" | "family_or_friend" | "unknown",
  "defendantName": string | null,
  "custody": { "inCustody": true | false | "unknown", "arrestDate": "YYYY-MM-DD"|null, "heldAt": string|null, "bailStatus": "not_set" | "set" | "posted" | "denied" | "unknown" },
  "court": { "courtName": string|null, "jurisdiction": string|null, "nextCourtDate": "YYYY-MM-DD"|null, "hearingType": "arraignment" | "bail" | "preliminary" | "trial" | "sentencing" | "probation_violation" | "other" | "unknown", "caseStage": "pre_charge" | "charged" | "pending" | "post_conviction" | "probation" | "unknown", "convictionDate": "YYYY-MM-DD"|null },
  "chargesStated": string[],
  "onProbationOrParole": true | false | "unknown",
  "hasActiveWarrant": true | false | "unknown",
  "namedParties": string[],
  "priorRepresentation": true | false | "unknown",
  "priorityScore": number,
  "scoreRationale": string,
  "routing": "sign_now" | "schedule_consult" | "nurture" | "decline",
  "missingInfo": string[],
  "confidence": number,
  "needsHumanReview": boolean
}

Field notes:
- contact: the person who WROTE IN — the one the firm will reply to. It is often a
  family member, not the person arrested. contact.phone: normalize spoken or
  spelled-out numbers to (XXX) XXX-XXXX. contact.preferredLanguage: a language code
  inferred from the message ("en", "es", ...).
- writerRole: "defendant" if the sender is the person charged, "family_or_friend"
  if they are writing for someone else, "unknown" if unclear. defendantName: the
  person arrested or charged, when it is not the sender; otherwise null.
- LANGUAGE: the people who read this case file work in English. Write
  scoreRationale and missingInfo in ENGLISH even when the message is in another
  language.
- WHAT HAPPENED: NEVER record, summarize, quote, or repeat what the person is
  accused of doing, or any account of events. Anything written here could be used
  against the person. Leave narrative out of EVERY field. chargesStated holds only
  charge NAMES that the sender actually WROTE ("DUI", "possession", "assault") —
  labels, never a description. NEVER work out a charge from described conduct: if
  the sender says someone "hit a guy" or "drove home drunk" but names no charge,
  chargesStated is [] — do not write "assault" or "DUI" for them. caseType follows
  the same rule: choose it from a charge the sender named; if none was named, use
  "other" (or "not_a_case" if it is not a criminal matter). scoreRationale is one short plain sentence about how urgently the
  firm should call (for example "Family member reports an arrest and an upcoming
  court date"), never about the facts of the incident.
- custody.inCustody: true only if the message or the form says someone is being
  held now (in jail or in a holding facility); otherwise false or "unknown". A
  form line "Is the person currently in custody? ... : Yes" means the PERSON
  ARRESTED is held — not necessarily the sender. If it is unclear who, add a
  missingInfo question about it.
- hasActiveWarrant: true only if the sender says a warrant is out for someone.
- Dates: extract ONLY dates the sender actually states. Do NOT compute a
  deadline, and do NOT infer a date. Use null when a date is not stated.
  convictionDate: only if the sender says there was a conviction or judgment.
- NO DEADLINES ANYWHERE: never state, estimate, or compute a deadline, due date,
  response window, or number of days remaining in ANY field — including
  scoreRationale and missingInfo. Application code computes those. You may quote a
  date the sender gave as a fact ("court date of September 30").
- namedParties: co-defendants, the complainant or alleged victim, and other people
  named. Used only for the firm's conflict check — never a description of them.
- priorityScore: 0-100, how strongly the firm should want to speak to this
  person soon. Someone in custody or with a court date this week is near the top.
- routing: "sign_now" only for a clear, in-scope criminal matter the firm should
  act on immediately; "decline" when the matter is outside criminal defense;
  "nurture" when too little is known to evaluate. Never use "decline" or
  "nurture" if the sender mentions custody, a warrant, or a court date.
- missingInfo: the specific questions intake still needs answered, as a human
  would phrase them — about who, where, and the court calendar only. NEVER ask
  what happened, whether the person did it, or for any account of events.
- confidence: 0-1, your confidence in this extraction overall.
- There is no reply field. The application sends fixed, reviewed text.`;

export function parseCriminalDefensively(text: string): CriminalModelOutput {
  return validateWith<CriminalModelOutput>(zCriminalModelOutput, parseJsonObject(text));
}

export function criminalExtractor(
  input: ExtractionInput,
  firmName: string
): AreaExtractor<CriminalModelOutput> {
  return {
    system: (today) =>
      conductRules(firmName, "criminal_defense") +
      "\n" +
      OUTPUT_CONTRACT.replace("{{TODAY}}", today).replace("{{RECEIVED}}", input.receivedLabel),
    parse: parseCriminalDefensively,
    // No cachedResponse: a real inquiry never gets a canned answer.
  };
}

/** Names worth checking against the conflict list for a criminal lead. */
export function criminalConflictNames(output: CriminalModelOutput): (string | null)[] {
  return [output.contact.name, output.defendantName, ...output.namedParties];
}

export interface BuildCriminalOptions {
  firmName: string;
  now?: Date;
  /**
   * The public form's explicit "is the person in custody" answer, when it had
   * one. A backstop: if the sender ticked Yes, code treats the person as in
   * custody even if the model missed it. Never downgrades the model.
   */
  formInCustody?: boolean;
}

const RATIONALE_MAX = 200;

const STOPWORDS = new Set(["the", "and", "for", "with", "not", "her", "his", "was"]);

/**
 * A charge label is kept only if the sender actually wrote it. The model is told
 * never to work a charge out of described conduct, but "hit a guy" -> "assault"
 * is exactly the slip a prompt can't guarantee against, so code checks: at least
 * one significant word of the label (compared by its first six letters, so
 * "assault" matches "assaulted") must appear in the message text. Fails safe —
 * an unmatched label is dropped, never invented.
 */
export function chargesSaidBySender(charges: string[], rawText: string): string[] {
  const text = rawText.toLowerCase();
  return charges.filter((c) =>
    c
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
      .some((w) => text.includes(w.slice(0, 6)))
  );
}

/** Keep the rationale to its first sentence — a long one is where narrative creeps in. */
function shortRationale(text: string): string {
  const cleaned = stripStatedDeadlines(text).trim();
  if (!cleaned) return "See the message below.";
  const first = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  return first.length > RATIONALE_MAX ? first.slice(0, RATIONALE_MAX - 1).trimEnd() + "…" : first;
}

// ── The trust boundary ───────────────────────────────────────────────────────
// Whatever the model said, code owns these:
//   1. deadlines / soonestDeadline — lib/criminal-deadlines.ts + date math
//   2. timeCritical — in custody, court date within 7 days or passed, an active
//      warrant, or a computed deadline within 7 days
//   3. conflictFlags — matched against the firm's conflict list
//   4. needsHumanReview — forced on low confidence, conflict, sign_now, time-critical
//   5. routing floor — a time-critical lead is never "decline" or "nurture"
//   6. the reply — always fixed code-written text (urgent wording when time-critical)
export function buildCriminalCaseFile(
  output: CriminalModelOutput,
  rawText: string,
  parties: ConflictParty[],
  opts: BuildCriminalOptions
): { caseFile: CriminalCaseFile; draftReply: string } {
  const now = opts.now ?? new Date();
  const conflictFlags = matchNames(criminalConflictNames(output), rawText, parties);

  const inCustody: boolean | "unknown" =
    opts.formInCustody === true ? true : output.custody.inCustody;

  const chargesStated = chargesSaidBySender(output.chargesStated, rawText);
  // No charge named by the sender: the case type was worked out from the story.
  // Don't keep it (it would record the conduct under another name).
  const caseType =
    output.chargesStated.length > 0 && chargesStated.length === 0 && output.caseType !== "not_a_case"
      ? "other"
      : output.caseType;

  const { deadlines, soonest } = computeCriminalDeadlines(
    {
      caseType,
      inCustody,
      arrestDate: output.custody.arrestDate,
      nextCourtDate: output.court.nextCourtDate,
      hearingType: output.court.hearingType,
      caseStage: output.court.caseStage,
      convictionDate: output.court.convictionDate,
    },
    now
  );

  const tc = computeCriminalTimeCritical(
    {
      inCustody,
      hasActiveWarrant: output.hasActiveWarrant,
      nextCourtDate: output.court.nextCourtDate,
      deadlines,
    },
    now
  );

  let routing = output.routing;
  if (tc.timeCritical && (routing === "decline" || routing === "nurture")) {
    routing = "schedule_consult";
  }

  let needsHumanReview = output.needsHumanReview;
  if (output.confidence < CRIMINAL_REVIEW_RULES.confidenceFloor) needsHumanReview = true;
  if (CRIMINAL_REVIEW_RULES.forcedOnConflict && conflictFlags.length > 0) needsHumanReview = true;
  if (CRIMINAL_REVIEW_RULES.forcedOnSignNow && routing === "sign_now") needsHumanReview = true;
  if (CRIMINAL_REVIEW_RULES.forcedOnTimeCritical && tc.timeCritical) needsHumanReview = true;

  const caseFile: CriminalCaseFile = {
    practiceArea: "criminal_defense",
    caseType,
    contact: output.contact,
    writerRole: output.writerRole,
    defendantName: output.defendantName,
    custody: { ...output.custody, inCustody },
    court: output.court,
    chargesStated,
    onProbationOrParole: output.onProbationOrParole,
    hasActiveWarrant: output.hasActiveWarrant,
    namedParties: output.namedParties,
    priorRepresentation: output.priorRepresentation,
    deadlines,
    soonestDeadline: soonest,
    timeCritical: tc.timeCritical,
    timeCriticalReasons: tc.reasons,
    priorityScore: Math.round(output.priorityScore),
    // Free text never carries a deadline past the acknowledgment gate, and the
    // rationale is cut to one sentence so no narrative accumulates in it.
    scoreRationale: shortRationale(output.scoreRationale),
    routing,
    missingInfo: output.missingInfo.map(stripStatedDeadlines).filter(Boolean),
    conflictFlags,
    confidence: output.confidence,
    needsHumanReview,
  };

  const draftReply = criminalReplyFor(output.contact.preferredLanguage, opts.firmName, tc.timeCritical);

  return { caseFile, draftReply };
}
