import { matchNames, type ConflictParty } from "./conflicts";
import {
  parseJsonObject,
  validateWith,
  type AreaExtractor,
  type ExtractionInput,
} from "./extract";
import {
  IMMIGRATION_REVIEW_RULES,
  conductRules,
  timeCriticalAckFor,
} from "./guardrails";
import { computeImmigrationDeadlines, computeTimeCritical } from "./immigration-deadlines";
import {
  zImmigrationModelOutput,
  type ImmigrationCaseFile,
  type ImmigrationModelOutput,
} from "./immigration-schema";

// Immigration intake: the model extracts and drafts; code decides deadlines,
// conflicts, time-critical status, and forced human review. Nothing here sends
// anything — a person approves every reply.

const OUTPUT_CONTRACT = `
Today's date is {{TODAY}}. Resolve relative dates ("last week", "in March")
against it. The message below arrived at the firm at {{RECEIVED}}.

Respond with ONLY a single JSON object — no preamble, no markdown fences, no
commentary. Schema (all fields required; use null where unknown):

{
  "caseType": "family_based" | "employment_based" | "asylum_humanitarian" | "naturalization_citizenship" | "status_change_extension" | "removal_defense" | "daca_tps" | "other" | "not_a_case",
  "applicant": { "name": string|null, "phone": string|null, "email": string|null, "preferredLanguage": string|null, "countryOfCitizenship": string|null },
  "currentStatus": "citizen" | "lpr" | "visa_holder" | "pending_application" | "undocumented" | "unknown",
  "currentStatusDetail": string | null,
  "statusExpirationDate": "YYYY-MM-DD" | null,
  "lastEntryDate": "YYYY-MM-DD" | null,
  "petitionerOrSponsor": { "name": string|null, "relationship": "family_member" | "employer" | "none" | "unknown" },
  "namedParties": string[],
  "pendingFiling": { "formType": string|null, "receiptNumber": string|null, "filedDate": "YYYY-MM-DD"|null },
  "noticeReceived": { "type": "rfe" | "noid" | "nta" | "denial" | "approval" | "none" | "unknown", "noticeDate": "YYYY-MM-DD"|null },
  "removal": { "inRemovalProceedings": true | false | "unknown", "nextHearingDate": "YYYY-MM-DD"|null, "ijDecisionDate": "YYYY-MM-DD"|null, "isDetained": true | false | "unknown" },
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
- applicant.phone: normalize spoken or spelled-out numbers to (XXX) XXX-XXXX.
- applicant.preferredLanguage: language code inferred from the message ("en", "es", ...).
- currentStatus and currentStatusDetail: record only what the sender says. Do
  NOT decide anyone's legal status. If they don't say, use "unknown".
- Dates: extract ONLY dates the sender actually states or that are printed on a
  notice they describe. Do NOT compute a deadline, and do NOT infer a date.
  Use null when a date is not stated.
- noticeReceived.type: "rfe" (request for evidence), "noid" (notice of intent
  to deny), "nta" (notice to appear in immigration court), "denial", "approval",
  "none" if they received no notice, "unknown" if unclear.
- removal.isDetained: true only if the sender says the person is in
  immigration detention or was just detained; otherwise false or "unknown".
- namedParties: other people or employers named in the message (family
  members, an employer). Used only for the firm's conflict check.
- priorityScore: 0-100, how strongly the firm should want to speak to this
  person soon. scoreRationale: one plain-English sentence.
- routing: "sign_now" only for a clear, in-scope matter the firm should act on
  immediately; "decline" when the matter is outside immigration law; "nurture"
  when too little is known to evaluate. Never use "decline" or "nurture" if the
  sender mentions detention or a court date.
- missingInfo: the specific questions intake still needs answered, as a human
  would phrase them. Never ask for an A-number, passport number, or SSN.
- confidence: 0-1, your confidence in this extraction overall.
- draftReply: a brief acknowledgment in the sender's language, following the
  conduct rules above. Do not add a signature block or disclaimer — the
  application appends the firm's standard disclaimer.`;

export function parseImmigrationDefensively(text: string): ImmigrationModelOutput {
  return validateWith<ImmigrationModelOutput>(zImmigrationModelOutput, parseJsonObject(text));
}

export function immigrationExtractor(
  input: ExtractionInput,
  firmName: string
): AreaExtractor<ImmigrationModelOutput> {
  return {
    system: (today) =>
      conductRules(firmName, "immigration") +
      "\n" +
      OUTPUT_CONTRACT.replace("{{TODAY}}", today).replace("{{RECEIVED}}", input.receivedLabel),
    parse: parseImmigrationDefensively,
    // No cachedResponse: a real inquiry never gets a canned answer.
  };
}

/** Names worth checking against the conflict list for an immigration lead. */
export function immigrationConflictNames(output: ImmigrationModelOutput): (string | null)[] {
  return [output.applicant.name, output.petitionerOrSponsor.name, ...output.namedParties];
}

export interface BuildImmigrationOptions {
  firmName: string;
  now?: Date;
  /**
   * The public form's explicit "someone is detained" answer, when it had one.
   * A backstop: if the sender ticked Yes, code treats the person as detained
   * even if the model missed it in free text. Never downgrades the model.
   */
  formDetained?: boolean;
}

// ── The trust boundary ───────────────────────────────────────────────────────
// Whatever the model said, code owns these:
//   1. deadlines / soonestDeadline — lib/immigration-deadlines.ts + date math
//   2. timeCritical — detained, hearing/deadline within 14 days, NTA with no date
//   3. conflictFlags — matched against the firm's conflict list
//   4. needsHumanReview — forced on low confidence, conflict, sign_now, time-critical
//   5. routing floor — a time-critical lead is never "decline" or "nurture"
//   6. the draft — for a time-critical lead, a fixed brief acknowledgment
export function buildImmigrationCaseFile(
  output: ImmigrationModelOutput,
  rawText: string,
  parties: ConflictParty[],
  opts: BuildImmigrationOptions
): { caseFile: ImmigrationCaseFile; draftReply: string } {
  const now = opts.now ?? new Date();
  const conflictFlags = matchNames(immigrationConflictNames(output), rawText, parties);

  const isDetained: boolean | "unknown" =
    opts.formDetained === true ? true : output.removal.isDetained;

  const { deadlines, soonest } = computeImmigrationDeadlines(
    {
      caseType: output.caseType,
      currentStatus: output.currentStatus,
      statusExpirationDate: output.statusExpirationDate,
      lastEntryDate: output.lastEntryDate,
      noticeType: output.noticeReceived.type,
      noticeDate: output.noticeReceived.noticeDate,
      inRemovalProceedings: output.removal.inRemovalProceedings,
      nextHearingDate: output.removal.nextHearingDate,
      ijDecisionDate: output.removal.ijDecisionDate,
    },
    now
  );

  const tc = computeTimeCritical(
    {
      isDetained,
      nextHearingDate: output.removal.nextHearingDate,
      noticeType: output.noticeReceived.type,
      deadlines,
    },
    now
  );

  let routing = output.routing;
  if (tc.timeCritical && (routing === "decline" || routing === "nurture")) {
    routing = "schedule_consult";
  }

  let needsHumanReview = output.needsHumanReview;
  if (output.confidence < IMMIGRATION_REVIEW_RULES.confidenceFloor) needsHumanReview = true;
  if (IMMIGRATION_REVIEW_RULES.forcedOnConflict && conflictFlags.length > 0) needsHumanReview = true;
  if (IMMIGRATION_REVIEW_RULES.forcedOnSignNow && routing === "sign_now") needsHumanReview = true;
  if (IMMIGRATION_REVIEW_RULES.forcedOnTimeCritical && tc.timeCritical) needsHumanReview = true;

  const caseFile: ImmigrationCaseFile = {
    practiceArea: "immigration",
    caseType: output.caseType,
    applicant: output.applicant,
    currentStatus: output.currentStatus,
    currentStatusDetail: output.currentStatusDetail,
    statusExpirationDate: output.statusExpirationDate,
    lastEntryDate: output.lastEntryDate,
    petitionerOrSponsor: output.petitionerOrSponsor,
    namedParties: output.namedParties,
    pendingFiling: output.pendingFiling,
    noticeReceived: output.noticeReceived,
    removal: { ...output.removal, isDetained },
    priorRepresentation: output.priorRepresentation,
    deadlines,
    soonestDeadline: soonest,
    timeCritical: tc.timeCritical,
    timeCriticalReasons: tc.reasons,
    priorityScore: Math.round(output.priorityScore),
    scoreRationale: output.scoreRationale,
    routing,
    missingInfo: output.missingInfo,
    conflictFlags,
    confidence: output.confidence,
    needsHumanReview,
  };

  const draftReply = tc.timeCritical
    ? timeCriticalAckFor(output.applicant.preferredLanguage, opts.firmName)
    : output.draftReply;

  return { caseFile, draftReply };
}

