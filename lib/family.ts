import { matchNames, type ConflictParty } from "./conflicts";
import { stripStatedDeadlines } from "./deadline-guard";
import {
  parseJsonObject,
  validateWith,
  type AreaExtractor,
  type ExtractionInput,
} from "./extract";
import { computeFamilyDeadlines, computeFamilyTimeCritical } from "./family-deadlines";
import {
  zFamilyModelOutput,
  type FamilyCaseFile,
  type FamilyModelOutput,
} from "./family-schema";
import { FAMILY_REVIEW_RULES, conductRules, timeCriticalAckFor } from "./guardrails";

// Family-law intake: the model extracts and drafts; code decides time-critical
// status, conflicts, and forced human review. There is no computed deadline
// table (lib/family-deadlines.ts explains why) — only dates the sender says
// they were actually told, shown as stated facts. Nothing here sends anything
// — a person approves every reply.

const OUTPUT_CONTRACT = `
Today's date is {{TODAY}}. Resolve relative dates ("last week", "next Tuesday")
against it. The message below arrived at the firm at {{RECEIVED}}.

Respond with ONLY a single JSON object — no preamble, no markdown fences, no
commentary. Schema (all fields required; use null where unknown):

{
  "caseType": "divorce" | "child_custody" | "child_support" | "spousal_support" | "protective_order" | "paternity" | "adoption" | "modification_enforcement" | "other" | "not_a_case",
  "contact": { "name": string|null, "phone": string|null, "email": string|null, "preferredLanguage": string|null },
  "otherParty": { "name": string|null, "relationship": "spouse" | "former_spouse" | "co_parent" | "other" | "unknown" },
  "childrenInvolved": true | false | "unknown",
  "safetyConcern": true | false | "unknown",
  "existingProtectiveOrder": true | false | "unknown",
  "court": { "courtName": string|null, "jurisdiction": string|null, "caseNumber": string|null, "caseStage": "not_yet_filed" | "filed" | "pending" | "post_judgment" | "unknown", "nextHearingDate": "YYYY-MM-DD"|null, "hearingType": "initial" | "temporary_orders" | "mediation" | "trial" | "other" | "unknown", "responseDueDate": "YYYY-MM-DD"|null },
  "servedWithPapers": true | false | "unknown",
  "namedParties": string[],
  "priorRepresentation": true | false | "unknown",
  "priorityScore": number,
  "scoreRationale": string,
  "routing": "sign_now" | "schedule_consult" | "nurture" | "decline",
  "missingInfo": string[],
  "confidence": number,
  "needsHumanReview": boolean,
  "draftReply": string
}

Field notes:
- contact: the person who WROTE IN — the one the firm will reply to.
  contact.phone: normalize spoken or spelled-out numbers to (XXX) XXX-XXXX.
  contact.preferredLanguage: a language code inferred from the message ("en", "es", ...).
- otherParty: the other side of the matter (a spouse, former spouse, or
  co-parent). Family-law cases are adversarial — the other side could contact
  this firm too — so record their name if the sender gives it. This is used
  only for the firm's conflict check, never characterized.
- childrenInvolved: a plain flag — whether the sender's message involves minor
  children (custody, support, a co-parenting dispute). Do not name or describe
  any child.
- SAFETY: safetyConcern and existingProtectiveOrder are FLAGS ONLY. Record
  true only if the sender clearly indicates domestic violence, abuse, or a
  need for protection, or the form says so. NEVER ask the sender to describe
  an incident, and never record or repeat any description they give — leave
  it entirely out of every field, including scoreRationale and missingInfo.
  If they describe an incident, extract only the flag.
- servedWithPapers: whether the sender says they were served with legal papers
  (a divorce petition, a custody motion). true/false/"unknown" only.
- court.responseDueDate: ONLY if the sender states a SPECIFIC date they were
  actually told their response is due (for example "I have until October 15
  to respond" or a date printed on papers they describe). Do NOT estimate a
  typical response window — family-law response deadlines vary enormously by
  state and county, and a guessed number here is exactly the kind of error
  this system exists to prevent. If they say they were served but give no
  date, leave responseDueDate null and add a missingInfo question asking when
  their response is due, so a human can check the papers.
- court.nextHearingDate: only a date the sender actually states.
- LANGUAGE: the people who read this case file work in English. Write
  scoreRationale and missingInfo in ENGLISH even when the message is in another
  language. Only draftReply follows the sender's language.
- NO DEADLINES ANYWHERE beyond a date stated as a fact above: never state,
  estimate, or compute a filing deadline, response window, or number of days
  remaining in ANY field — including scoreRationale and missingInfo.
  Application code does date math only on the two stated dates above; there is
  no legal-rule table for family-law procedural deadlines.
- namedParties: other people named (opposing counsel, a mediator, a new
  partner) — used only for the firm's conflict check.
- priorityScore: 0-100, how strongly the firm should want to speak to this
  person soon. A reported safety concern or an imminent hearing is near the
  top. scoreRationale: one short plain sentence about how urgently the firm
  should call — never a description of any incident.
- routing: "sign_now" only for a clear, in-scope matter the firm should act on
  immediately; "decline" when the matter is outside family law; "nurture" when
  too little is known to evaluate. Never use "decline" or "nurture" if the
  sender reports a safety concern or an imminent hearing.
- missingInfo: the specific questions intake still needs answered, as a human
  would phrase them. Never ask the sender to describe an incident.
- confidence: 0-1, your confidence in this extraction overall.
- draftReply: a brief acknowledgment in the sender's language, following the
  conduct rules above. Do not add a signature block or disclaimer — the
  application appends the firm's standard disclaimer.`;

export function parseFamilyDefensively(text: string): FamilyModelOutput {
  return validateWith<FamilyModelOutput>(zFamilyModelOutput, parseJsonObject(text));
}

export function familyExtractor(
  input: ExtractionInput,
  firmName: string
): AreaExtractor<FamilyModelOutput> {
  return {
    system: (today) =>
      conductRules(firmName, "family_law") +
      "\n" +
      OUTPUT_CONTRACT.replace("{{TODAY}}", today).replace("{{RECEIVED}}", input.receivedLabel),
    parse: parseFamilyDefensively,
    // No cachedResponse: a real inquiry never gets a canned answer.
  };
}

/** Names worth checking against the conflict list for a family-law lead. */
export function familyConflictNames(output: FamilyModelOutput): (string | null)[] {
  return [output.contact.name, output.otherParty.name, ...output.namedParties];
}

const RATIONALE_MAX = 200;

/**
 * Keep the rationale to its first sentence, the same backstop
 * lib/criminal.ts applies. The prompt tells the model never to narrate a
 * safety incident, but a model that slips is exactly what this guards
 * against: a second sentence is where narrative creeps in.
 */
function shortRationale(text: string): string {
  const cleaned = stripStatedDeadlines(text).trim();
  if (!cleaned) return "See the message below.";
  const first = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  return first.length > RATIONALE_MAX ? first.slice(0, RATIONALE_MAX - 1).trimEnd() + "…" : first;
}

export interface BuildFamilyOptions {
  firmName: string;
  now?: Date;
  /**
   * The public form's explicit "safety concern" answer, when it had one. A
   * backstop: if the sender ticked Yes, code treats it as reported even if
   * the model missed it in free text. Never downgrades the model.
   */
  formSafetyConcern?: boolean;
}

// ── The trust boundary ───────────────────────────────────────────────────────
// Whatever the model said, code owns these:
//   1. deadlines / soonestDeadline — lib/family-deadlines.ts, date math on
//      stated facts only (no rule table exists for this area)
//   2. timeCritical — a reported safety concern, or a stated date within 7 days
//   3. conflictFlags — matched against the firm's conflict list, both sides
//   4. needsHumanReview — forced on low confidence, conflict, sign_now, time-critical
//   5. routing floor — a time-critical lead is never "decline" or "nurture"
//   6. the draft — for a time-critical lead, a fixed brief acknowledgment
//   7. scoreRationale — cut to its first sentence, so a model that narrates a
//      safety incident past its instructions can't carry it past this point
export function buildFamilyCaseFile(
  output: FamilyModelOutput,
  rawText: string,
  parties: ConflictParty[],
  opts: BuildFamilyOptions
): { caseFile: FamilyCaseFile; draftReply: string } {
  const now = opts.now ?? new Date();
  const conflictFlags = matchNames(familyConflictNames(output), rawText, parties);

  const safetyConcern: boolean | "unknown" =
    opts.formSafetyConcern === true ? true : output.safetyConcern;

  const { deadlines, soonest } = computeFamilyDeadlines(
    {
      nextHearingDate: output.court.nextHearingDate,
      hearingType: output.court.hearingType,
      responseDueDate: output.court.responseDueDate,
    },
    now
  );

  const tc = computeFamilyTimeCritical({ safetyConcern, deadlines });

  let routing = output.routing;
  if (tc.timeCritical && (routing === "decline" || routing === "nurture")) {
    routing = "schedule_consult";
  }

  let needsHumanReview = output.needsHumanReview;
  if (output.confidence < FAMILY_REVIEW_RULES.confidenceFloor) needsHumanReview = true;
  if (FAMILY_REVIEW_RULES.forcedOnConflict && conflictFlags.length > 0) needsHumanReview = true;
  if (FAMILY_REVIEW_RULES.forcedOnSignNow && routing === "sign_now") needsHumanReview = true;
  if (FAMILY_REVIEW_RULES.forcedOnTimeCritical && tc.timeCritical) needsHumanReview = true;

  const caseFile: FamilyCaseFile = {
    practiceArea: "family_law",
    caseType: output.caseType,
    contact: output.contact,
    otherParty: output.otherParty,
    childrenInvolved: output.childrenInvolved,
    safetyConcern,
    existingProtectiveOrder: output.existingProtectiveOrder,
    court: output.court,
    servedWithPapers: output.servedWithPapers,
    namedParties: output.namedParties,
    priorRepresentation: output.priorRepresentation,
    deadlines,
    soonestDeadline: soonest,
    timeCritical: tc.timeCritical,
    timeCriticalReasons: tc.reasons,
    priorityScore: Math.round(output.priorityScore),
    // Cut to one sentence — free text never carries a deadline or a narrative
    // past this point (see shortRationale above).
    scoreRationale: shortRationale(output.scoreRationale),
    routing,
    missingInfo: output.missingInfo.map(stripStatedDeadlines).filter(Boolean),
    conflictFlags,
    confidence: output.confidence,
    needsHumanReview,
  };

  const draftReply = tc.timeCritical
    ? timeCriticalAckFor(output.contact.preferredLanguage, opts.firmName)
    : output.draftReply;

  return { caseFile, draftReply };
}
