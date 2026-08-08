import type { CaseType, Routing, TreatmentStatus } from "./schema";

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
