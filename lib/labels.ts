import type {
  CurrentStatus,
  ImmigrationCaseType,
  NoticeType,
} from "./immigration-schema";
import type { CaseType, PracticeArea, Routing, TreatmentStatus } from "./schema";

// Firm-side vocabulary. The UI never shows system enum values.

export const CASE_TYPE_LABEL: Record<CaseType, string> = {
  motor_vehicle: "Motor vehicle",
  premises_liability: "Premises liability",
  dog_bite: "Dog bite",
  medical_malpractice: "Medical malpractice",
  workers_comp: "Workers' comp",
  product_liability: "Product liability",
  other: "Other injury",
  not_a_case: "Not a case",
};

export const PRACTICE_AREA_LABEL: Record<PracticeArea, string> = {
  personal_injury: "Personal injury",
  immigration: "Immigration",
};

// What a firm's `practiceLine` (the free-text display label) defaults to when
// left blank.
export const DEFAULT_PRACTICE_LINE: Record<PracticeArea, string> = {
  personal_injury: "Injury Law",
  immigration: "Immigration Law",
};

export const IMMIGRATION_CASE_TYPE_LABEL: Record<ImmigrationCaseType, string> = {
  family_based: "Family-based",
  employment_based: "Employment-based",
  asylum_humanitarian: "Asylum / humanitarian",
  naturalization_citizenship: "Naturalization / citizenship",
  status_change_extension: "Status change / extension",
  removal_defense: "Removal defense",
  daca_tps: "DACA / TPS",
  other: "Other immigration",
  not_a_case: "Not a case",
};

export const CURRENT_STATUS_LABEL: Record<CurrentStatus, string> = {
  citizen: "Says they are a citizen",
  lpr: "Says they are a green-card holder",
  visa_holder: "Says they hold a visa",
  pending_application: "Says an application is pending",
  undocumented: "Says they have no status",
  unknown: "Status not stated",
};

export const NOTICE_TYPE_LABEL: Record<NoticeType, string> = {
  rfe: "Request for Evidence",
  noid: "Notice of Intent to Deny",
  nta: "Notice to Appear",
  denial: "Denial",
  approval: "Approval",
  none: "No notice",
  unknown: "Notice unclear",
};

export const TREATMENT_LABEL: Record<TreatmentStatus, string> = {
  er_visit: "ER visit",
  ongoing_treatment: "In treatment",
  saw_doctor_once: "Saw a doctor once",
  no_treatment: "No treatment yet",
  unknown: "Treatment unknown",
};

export const ROUTING_LABEL: Record<Routing, string> = {
  sign_now: "SIGN NOW",
  schedule_consult: "SCHEDULE CONSULT",
  nurture: "NEEDS FOLLOW-UP",
  decline: "DECLINED",
};

export const ROUTING_SENTENCE: Record<Routing, string> = {
  sign_now: "Strong case — call first thing and send the retainer",
  schedule_consult: "Worth a consult — get them on the calendar",
  nurture: "Not enough to evaluate — keep the conversation going",
  decline: "Not a case for the firm — decline kindly, refer out",
};

export const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  es: "Spanish",
};

export const CHANNEL_LABEL: Record<string, string> = {
  voicemail: "Voicemail",
  sms: "Text message",
  webform: "Website form",
  whatsapp: "WhatsApp",
};

// What actually happened to a lead, recorded by a reviewer after the fact —
// see leads.outcome. Independent of the model; used for accuracy reporting.
export type Outcome = "signed" | "declined" | "lost" | "no_response";
export const OUTCOMES: Outcome[] = ["signed", "declined", "lost", "no_response"];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  signed: "Signed",
  declined: "Declined",
  lost: "Lost",
  no_response: "No response",
};
