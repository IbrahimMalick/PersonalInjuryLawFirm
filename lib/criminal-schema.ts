import { z } from "zod";
import { ROUTINGS, type Routing } from "./schema";

// ── The criminal-defense CaseFile contract ───────────────────────────────────
// Same trust boundary as the other practice areas: the model extracts; code
// decides deadlines, time-critical status, conflicts, forced review, AND the
// reply. Two things are different here, on purpose:
//
//   1. There is NO field for what allegedly happened. Anything a person writes
//      in a text, email, or voicemail before a lawyer is engaged can be used
//      against them, so the model is told never to record or repeat it. The
//      case file holds only who, where they are, and the court calendar.
//   2. There is NO draftReply. Every reply is fixed text written by code
//      (lib/guardrails.ts) — a model-written reply could ask about the facts.

export const CRIMINAL_CASE_TYPES = [
  "dui_dwi",
  "drug",
  "assault_violence",
  "domestic_violence",
  "theft_property",
  "weapons",
  "traffic",
  "probation_violation",
  "juvenile",
  "white_collar",
  "other",
  "not_a_case",
] as const;
export type CriminalCaseType = (typeof CRIMINAL_CASE_TYPES)[number];

export const WRITER_ROLES = ["defendant", "family_or_friend", "unknown"] as const;
export type WriterRole = (typeof WRITER_ROLES)[number];

export const BAIL_STATUSES = ["not_set", "set", "posted", "denied", "unknown"] as const;
export type BailStatus = (typeof BAIL_STATUSES)[number];

export const HEARING_TYPES = [
  "arraignment",
  "bail",
  "preliminary",
  "trial",
  "sentencing",
  "probation_violation",
  "other",
  "unknown",
] as const;
export type HearingType = (typeof HEARING_TYPES)[number];

export const CASE_STAGES = [
  "pre_charge",
  "charged",
  "pending",
  "post_conviction",
  "probation",
  "unknown",
] as const;
export type CaseStage = (typeof CASE_STAGES)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)")
  .refine((s) => !Number.isNaN(Date.parse(s)), "is not a real calendar date");

const triState = z.union([z.boolean(), z.literal("unknown")]);

export const zCriminalModelOutput = z.object({
  caseType: z.enum(CRIMINAL_CASE_TYPES),
  // The person who wrote in — the one the reply goes to. Often a family member.
  contact: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    preferredLanguage: z.string().nullable(), // "en", "es", ...
  }),
  writerRole: z.enum(WRITER_ROLES),
  defendantName: z.string().nullable(), // who was arrested, if not the writer
  custody: z.object({
    inCustody: triState,
    arrestDate: isoDate.nullable(),
    heldAt: z.string().nullable(), // jail or facility name, as stated
    bailStatus: z.enum(BAIL_STATUSES),
  }),
  court: z.object({
    courtName: z.string().nullable(),
    jurisdiction: z.string().nullable(), // county / state, as stated
    nextCourtDate: isoDate.nullable(),
    hearingType: z.enum(HEARING_TYPES),
    caseStage: z.enum(CASE_STAGES),
    convictionDate: isoDate.nullable(), // only if the sender says there was a conviction
  }),
  // Charge names as stated ("DUI", "possession") — a label, never a narrative.
  chargesStated: z.array(z.string()),
  onProbationOrParole: triState,
  hasActiveWarrant: triState,
  // Co-defendants, the complainant, witnesses — used only for the conflict check.
  namedParties: z.array(z.string()),
  priorRepresentation: triState,
  priorityScore: z.number().min(0).max(100),
  scoreRationale: z.string(),
  routing: z.enum(ROUTINGS),
  missingInfo: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean(),
});
export type CriminalModelOutput = z.infer<typeof zCriminalModelOutput>;

// ── Computed by code ─────────────────────────────────────────────────────────

export type CriminalDeadlineTrigger =
  | "court_date"
  | "notice_of_appeal"
  | "license_hearing_request";

export interface CriminalDeadline {
  trigger: CriminalDeadlineTrigger;
  label: string;
  /** "computed" has a date; "needs_trigger" means a fact is missing — no guessing. */
  kind: "computed" | "needs_trigger";
  deadlineISO: string | null;
  daysRemaining: number | null; // negative once passed
  basis: string;
}

export interface CriminalCaseFile {
  practiceArea: "criminal_defense";
  caseType: CriminalCaseType;
  contact: CriminalModelOutput["contact"];
  writerRole: WriterRole;
  defendantName: string | null;
  custody: CriminalModelOutput["custody"];
  court: CriminalModelOutput["court"];
  chargesStated: string[];
  onProbationOrParole: boolean | "unknown";
  hasActiveWarrant: boolean | "unknown";
  namedParties: string[];
  priorRepresentation: boolean | "unknown";
  deadlines: CriminalDeadline[]; // computed by code, soonest first
  soonestDeadline: CriminalDeadline | null; // computed by code
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
