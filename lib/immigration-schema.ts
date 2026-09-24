import { z } from "zod";
import { ROUTINGS, type Routing } from "./schema";

// ── The immigration CaseFile contract ────────────────────────────────────────
// Same trust boundary as personal injury: the model is asked for
// ImmigrationModelOutput (extracted facts + a score + a draft reply). Our code
// then builds the final ImmigrationCaseFile:
//   - deadlines are COMPUTED from lib/immigration-deadlines.ts — never model output
//   - timeCritical is COMPUTED by code — never model output
//   - conflictFlags is COMPUTED against the firm's conflict list
//   - needsHumanReview is FORCED true by code (see lib/immigration.ts)
// The model extracts trigger FACTS (a notice type and date, a hearing date, an
// expiration date). It never states a deadline.

export const IMMIGRATION_CASE_TYPES = [
  "family_based",
  "employment_based",
  "asylum_humanitarian",
  "naturalization_citizenship",
  "status_change_extension",
  "removal_defense",
  "daca_tps",
  "other",
  "not_a_case",
] as const;
export type ImmigrationCaseType = (typeof IMMIGRATION_CASE_TYPES)[number];

export const CURRENT_STATUSES = [
  "citizen",
  "lpr",
  "visa_holder",
  "pending_application",
  "undocumented",
  "unknown",
] as const;
export type CurrentStatus = (typeof CURRENT_STATUSES)[number];

export const NOTICE_TYPES = ["rfe", "noid", "nta", "denial", "approval", "none", "unknown"] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

export const SPONSOR_RELATIONSHIPS = ["family_member", "employer", "none", "unknown"] as const;
export type SponsorRelationship = (typeof SPONSOR_RELATIONSHIPS)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)")
  .refine((s) => !Number.isNaN(Date.parse(s)), "is not a real calendar date");

const triState = z.union([z.boolean(), z.literal("unknown")]);

export const zImmigrationModelOutput = z.object({
  caseType: z.enum(IMMIGRATION_CASE_TYPES),
  applicant: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    preferredLanguage: z.string().nullable(), // "en", "es", ...
    countryOfCitizenship: z.string().nullable(),
  }),
  currentStatus: z.enum(CURRENT_STATUSES),
  currentStatusDetail: z.string().nullable(), // e.g. "F-1", "H-1B"
  statusExpirationDate: isoDate.nullable(),
  lastEntryDate: isoDate.nullable(),
  petitionerOrSponsor: z.object({
    name: z.string().nullable(),
    relationship: z.enum(SPONSOR_RELATIONSHIPS),
  }),
  // Other people or employers named in the message — used only for the
  // conflict check, never shown as a finding.
  namedParties: z.array(z.string()),
  pendingFiling: z.object({
    formType: z.string().nullable(), // e.g. "I-130"
    receiptNumber: z.string().nullable(),
    filedDate: isoDate.nullable(),
  }),
  noticeReceived: z.object({
    type: z.enum(NOTICE_TYPES),
    noticeDate: isoDate.nullable(),
  }),
  removal: z.object({
    inRemovalProceedings: triState,
    nextHearingDate: isoDate.nullable(),
    // Date of an immigration judge's decision, if the sender mentions one.
    ijDecisionDate: isoDate.nullable(),
    isDetained: triState,
  }),
  priorRepresentation: triState,
  priorityScore: z.number().min(0).max(100),
  scoreRationale: z.string(),
  routing: z.enum(ROUTINGS),
  missingInfo: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean(),
  draftReply: z.string(),
});
export type ImmigrationModelOutput = z.infer<typeof zImmigrationModelOutput>;

// ── Computed by code ─────────────────────────────────────────────────────────

export type DeadlineTrigger =
  | "rfe"
  | "noid"
  | "bia_appeal"
  | "motion_to_reopen"
  | "asylum_one_year"
  | "status_expiration"
  | "hearing";

export interface ImmigrationDeadline {
  trigger: DeadlineTrigger;
  label: string;
  /** "computed" has a date; "needs_trigger" means a fact is missing — no guessing. */
  kind: "computed" | "needs_trigger";
  deadlineISO: string | null;
  daysRemaining: number | null; // negative once passed
  basis: string;
  /** Documented separately, NOT added to deadlineISO (conservative: the earlier date). */
  mailingAllowanceDays?: number;
}

export interface ImmigrationCaseFile {
  practiceArea: "immigration";
  caseType: ImmigrationCaseType;
  applicant: ImmigrationModelOutput["applicant"];
  currentStatus: CurrentStatus;
  currentStatusDetail: string | null;
  statusExpirationDate: string | null;
  lastEntryDate: string | null;
  petitionerOrSponsor: ImmigrationModelOutput["petitionerOrSponsor"];
  namedParties: string[];
  pendingFiling: ImmigrationModelOutput["pendingFiling"];
  noticeReceived: ImmigrationModelOutput["noticeReceived"];
  removal: ImmigrationModelOutput["removal"];
  priorRepresentation: boolean | "unknown";
  deadlines: ImmigrationDeadline[]; // computed by code, soonest first
  soonestDeadline: ImmigrationDeadline | null; // computed by code
  timeCritical: boolean; // computed by code
  timeCriticalReasons: string[]; // coarse categories — never dates
  priorityScore: number;
  scoreRationale: string;
  routing: Routing;
  missingInfo: string[];
  conflictFlags: string[]; // computed by code
  confidence: number;
  needsHumanReview: boolean; // forced by code
}
