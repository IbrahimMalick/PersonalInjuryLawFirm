import { z } from "zod";

// ── The CaseFile contract ────────────────────────────────────────────────────
// The model is asked for ModelOutput (extraction fields + jurisdiction guess +
// draft reply). Our code then builds the final CaseFile:
//   - statuteOfLimitations is COMPUTED from lib/sol-table.ts — never model output
//   - conflictFlags is COMPUTED against data/adverse-parties.json — never model output
//   - needsHumanReview is FORCED true on low confidence, conflicts, or sign_now

export const CASE_TYPES = [
  "motor_vehicle",
  "premises_liability",
  "dog_bite",
  "medical_malpractice",
  "workers_comp",
  "product_liability",
  "other",
  "not_a_case",
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const TREATMENT_STATUSES = [
  "er_visit",
  "ongoing_treatment",
  "saw_doctor_once",
  "no_treatment",
  "unknown",
] as const;
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number];

export const ROUTINGS = ["sign_now", "schedule_consult", "nurture", "decline"] as const;
export type Routing = (typeof ROUTINGS)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "incidentDate must be an ISO date (YYYY-MM-DD)")
  .refine((s) => !Number.isNaN(Date.parse(s)), "incidentDate is not a real calendar date");

export const zModelOutput = z.object({
  caseType: z.enum(CASE_TYPES),
  incidentDate: isoDate.nullable(),
  incidentLocation: z.string().nullable(),
  claimant: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    preferredLanguage: z.string().nullable(), // BCP-47-ish: "en", "es"
  }),
  injuryDescription: z.string().nullable(),
  treatmentStatus: z.enum(TREATMENT_STATUSES),
  liabilityClarity: z.enum(["clear", "disputed", "unclear"]),
  liabilityNote: z.string(),
  otherPartyInfo: z.object({
    name: z.string().nullable(),
    insurer: z.string().nullable(),
    policyLimits: z.string().nullable(),
  }),
  priorRepresentation: z.union([z.boolean(), z.literal("unknown")]),
  // Two-letter US state guess for the incident jurisdiction; our code does the SOL math.
  jurisdiction: z.string().length(2).nullable(),
  priorityScore: z.number().min(0).max(100),
  scoreRationale: z.string(),
  routing: z.enum(ROUTINGS),
  missingInfo: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean(),
  draftReply: z.string(),
});
export type ModelOutput = z.infer<typeof zModelOutput>;

export interface StatuteOfLimitations {
  jurisdiction: string | null;
  deadlineISO: string | null;
  daysRemaining: number | null;
  basis: string | null;
}

export interface CaseFile {
  caseType: CaseType;
  incidentDate: string | null;
  incidentLocation: string | null;
  claimant: {
    name: string | null;
    phone: string | null;
    email: string | null;
    preferredLanguage: string | null;
  };
  injuryDescription: string | null;
  treatmentStatus: TreatmentStatus;
  liabilityClarity: "clear" | "disputed" | "unclear";
  liabilityNote: string;
  otherPartyInfo: {
    name: string | null;
    insurer: string | null;
    policyLimits: string | null;
  };
  priorRepresentation: boolean | "unknown";
  statuteOfLimitations: StatuteOfLimitations; // computed by code
  priorityScore: number;
  scoreRationale: string;
  routing: Routing;
  missingInfo: string[];
  conflictFlags: string[]; // computed by code
  confidence: number;
  needsHumanReview: boolean;
}

// ── Inbox / store types ──────────────────────────────────────────────────────

export type Channel = "voicemail" | "sms" | "webform" | "whatsapp";

export interface Lead {
  id: string;
  channel: Channel;
  from: string; // display source: phone number or form origin
  displayName: string | null; // name if the channel provides one (WhatsApp)
  raw: string; // the message as it arrived — transcript, SMS text, form dump
  meta?: {
    durationSec?: number; // voicemail
    photos?: string[]; // whatsapp attachments referenced
    formFields?: Record<string, string>;
  };
  receivedOffsetMin: number; // minutes relative to the 2:47 AM sim start (negative = earlier)
  receivedLabel: string; // human label, e.g. "8:52 PM" — what the feed shows
  hidden?: boolean; // conflict lead: only surfaces via "Run the conflict lead"
  breakIt?: boolean; // injected malformed lead: first parse attempt is corrupted
  status: "new" | "processing" | "done";
  caseFile?: CaseFile;
  draftReply?: string;
  processedVia?: "live" | "fallback";
  processedAtSim?: string; // sim-clock label at completion
}

export interface ActivityEntry {
  t: string; // sim-clock label, e.g. "3:14 AM"
  line: string;
  kind: "info" | "ok" | "warn" | "flag";
}

export interface Store {
  seededAt: string; // real ISO timestamp of last reset — anchors relative dates
  leads: Lead[];
  activity: ActivityEntry[];
}
