import { z } from "zod";
import { ROUTINGS, type Routing } from "./schema";

// ── The family-law CaseFile contract ─────────────────────────────────────────
// Same trust boundary as the other areas: the model extracts and drafts a
// reply; code decides time-critical status, conflicts, and forced review. Two
// things are different here, on purpose:
//
//   1. Family law is adversarial — the other side of the case may also
//      contact the firm one day — so `otherParty` is a first-class field,
//      always checked against the conflict list alongside the sender.
//   2. There is no reviewed deadline table (see lib/family-deadlines.ts for
//      why: filing and response windows vary too much by state and county to
//      publish safely). A date the sender was actually TOLD (a hearing, a
//      response-due date) is recorded and shown as a plain stated fact, never
//      computed from a rule. A safety concern (domestic violence, a need for
//      a protective order) is recorded as a flag only — never narrative.

export const FAMILY_CASE_TYPES = [
  "divorce",
  "child_custody",
  "child_support",
  "spousal_support",
  "protective_order",
  "paternity",
  "adoption",
  "modification_enforcement",
  "other",
  "not_a_case",
] as const;
export type FamilyCaseType = (typeof FAMILY_CASE_TYPES)[number];

export const OTHER_PARTY_RELATIONSHIPS = [
  "spouse",
  "former_spouse",
  "co_parent",
  "other",
  "unknown",
] as const;
export type OtherPartyRelationship = (typeof OTHER_PARTY_RELATIONSHIPS)[number];

export const FAMILY_HEARING_TYPES = [
  "initial",
  "temporary_orders",
  "mediation",
  "trial",
  "other",
  "unknown",
] as const;
export type FamilyHearingType = (typeof FAMILY_HEARING_TYPES)[number];

export const FAMILY_CASE_STAGES = [
  "not_yet_filed",
  "filed",
  "pending",
  "post_judgment",
  "unknown",
] as const;
export type FamilyCaseStage = (typeof FAMILY_CASE_STAGES)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)")
  .refine((s) => !Number.isNaN(Date.parse(s)), "is not a real calendar date");

const triState = z.union([z.boolean(), z.literal("unknown")]);

export const zFamilyModelOutput = z.object({
  caseType: z.enum(FAMILY_CASE_TYPES),
  // The person who wrote in — the one the reply goes to.
  contact: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    preferredLanguage: z.string().nullable(), // "en", "es", ...
  }),
  // The other side of the case — always relevant for the conflict check.
  otherParty: z.object({
    name: z.string().nullable(),
    relationship: z.enum(OTHER_PARTY_RELATIONSHIPS),
  }),
  childrenInvolved: triState,
  // Flags only — never a description of any incident.
  safetyConcern: triState,
  existingProtectiveOrder: triState,
  court: z.object({
    courtName: z.string().nullable(),
    jurisdiction: z.string().nullable(), // county / state, as stated
    caseNumber: z.string().nullable(),
    caseStage: z.enum(FAMILY_CASE_STAGES),
    nextHearingDate: isoDate.nullable(),
    hearingType: z.enum(FAMILY_HEARING_TYPES),
    // ONLY a date the sender says they were actually told — never inferred.
    responseDueDate: isoDate.nullable(),
  }),
  servedWithPapers: triState,
  // Other people named (opposing counsel, a mediator, a co-parent's new
  // partner) — used only for the firm's conflict check.
  namedParties: z.array(z.string()),
  priorRepresentation: triState,
  priorityScore: z.number().min(0).max(100),
  scoreRationale: z.string(),
  routing: z.enum(ROUTINGS),
  missingInfo: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean(),
  draftReply: z.string(),
});
export type FamilyModelOutput = z.infer<typeof zFamilyModelOutput>;

// ── Computed by code ─────────────────────────────────────────────────────────

export type FamilyDateTrigger = "hearing" | "response_due";

export interface FamilyDate {
  trigger: FamilyDateTrigger;
  label: string;
  /** Always "stated" — there is no rule table here; see lib/family-deadlines.ts. */
  kind: "stated";
  deadlineISO: string;
  daysRemaining: number; // negative once passed; date math only, no legal rule
  basis: string;
}

export interface FamilyCaseFile {
  practiceArea: "family_law";
  caseType: FamilyCaseType;
  contact: FamilyModelOutput["contact"];
  otherParty: FamilyModelOutput["otherParty"];
  childrenInvolved: boolean | "unknown";
  safetyConcern: boolean | "unknown";
  existingProtectiveOrder: boolean | "unknown";
  court: FamilyModelOutput["court"];
  servedWithPapers: boolean | "unknown";
  namedParties: string[];
  priorRepresentation: boolean | "unknown";
  deadlines: FamilyDate[]; // computed (date math on stated facts) by code, soonest first
  soonestDeadline: FamilyDate | null; // computed by code
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
