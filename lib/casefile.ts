import { CRIMINAL_CASE_TYPES, type CriminalCaseFile } from "./criminal-schema";
import { FAMILY_CASE_TYPES, type FamilyCaseFile } from "./family-schema";
import { IMMIGRATION_CASE_TYPES, type ImmigrationCaseFile } from "./immigration-schema";
import {
  CASE_TYPE_LABEL,
  CRIMINAL_CASE_TYPE_LABEL,
  FAMILY_CASE_TYPE_LABEL,
  IMMIGRATION_CASE_TYPE_LABEL,
} from "./labels";
import { CASE_TYPES, type CaseFile, type PracticeArea } from "./schema";

// A stored case file is one of four shapes, told apart by `practiceArea`. Every
// case file written before practice areas existed has no such field and is
// personal injury. Consumers that don't care which shape they have use these
// helpers; consumers that do care narrow with isImmigrationCaseFile /
// isCriminalCaseFile / isFamilyCaseFile — never `any`.

export type AnyCaseFile = CaseFile | ImmigrationCaseFile | CriminalCaseFile | FamilyCaseFile;

export function isImmigrationCaseFile(cf: AnyCaseFile): cf is ImmigrationCaseFile {
  return cf.practiceArea === "immigration";
}

export function isCriminalCaseFile(cf: AnyCaseFile): cf is CriminalCaseFile {
  return cf.practiceArea === "criminal_defense";
}

export function isFamilyCaseFile(cf: AnyCaseFile): cf is FamilyCaseFile {
  return cf.practiceArea === "family_law";
}

export function practiceAreaOf(cf: AnyCaseFile): PracticeArea {
  if (isImmigrationCaseFile(cf)) return "immigration";
  if (isCriminalCaseFile(cf)) return "criminal_defense";
  if (isFamilyCaseFile(cf)) return "family_law";
  return "personal_injury";
}

export interface CaseContact {
  name: string | null;
  phone: string | null;
  email: string | null;
  preferredLanguage: string | null;
}

/** The person who wrote in — `claimant` (PI), `applicant` (immigration), `contact` (criminal defense, family law). */
export function contactOf(cf: AnyCaseFile): CaseContact {
  const c = isImmigrationCaseFile(cf)
    ? cf.applicant
    : isCriminalCaseFile(cf) || isFamilyCaseFile(cf)
      ? cf.contact
      : cf.claimant;
  return {
    name: c.name,
    phone: c.phone,
    email: c.email,
    preferredLanguage: c.preferredLanguage,
  };
}

export function caseTypeLabelOf(cf: AnyCaseFile): string {
  if (isImmigrationCaseFile(cf)) return IMMIGRATION_CASE_TYPE_LABEL[cf.caseType];
  if (isCriminalCaseFile(cf)) return CRIMINAL_CASE_TYPE_LABEL[cf.caseType];
  if (isFamilyCaseFile(cf)) return FAMILY_CASE_TYPE_LABEL[cf.caseType];
  return CASE_TYPE_LABEL[cf.caseType];
}

/** The case-type dropdown options for a firm's practice area — value is the raw enum, used to filter stored case files. */
export function caseTypeOptionsFor(area: PracticeArea): { value: string; label: string }[] {
  if (area === "immigration") {
    return IMMIGRATION_CASE_TYPES.map((v) => ({ value: v, label: IMMIGRATION_CASE_TYPE_LABEL[v] }));
  }
  if (area === "criminal_defense") {
    return CRIMINAL_CASE_TYPES.map((v) => ({ value: v, label: CRIMINAL_CASE_TYPE_LABEL[v] }));
  }
  if (area === "family_law") {
    return FAMILY_CASE_TYPES.map((v) => ({ value: v, label: FAMILY_CASE_TYPE_LABEL[v] }));
  }
  return CASE_TYPES.map((v) => ({ value: v, label: CASE_TYPE_LABEL[v] }));
}

/** Longest status detail that reads as a label ("F-1", "expired visitor visa") rather than prose. */
export const STATUS_DETAIL_LABEL_MAX = 40;

/**
 * The model is told to keep currentStatusDetail to a short label, but it can
 * still return a sentence. A label goes beside the status heading; anything
 * longer is shown as a small note instead of shouting in the heading. Never
 * dropped — a reviewer may still need it.
 */
export function splitStatusDetail(detail: string | null): {
  inline: string | null;
  note: string | null;
} {
  const d = detail?.trim();
  if (!d) return { inline: null, note: null };
  return d.length <= STATUS_DETAIL_LABEL_MAX ? { inline: d, note: null } : { inline: null, note: d };
}

/** The one-line guidance under the reply panel. Time-critical leads never get the sales-y routing line. */
export function guidanceSentence(cf: AnyCaseFile, routingSentence: string): string {
  return isTimeCritical(cf) ? "Time-critical — call now, do not wait for morning" : routingSentence;
}

export function isTimeCritical(cf: AnyCaseFile | null | undefined): boolean {
  return Boolean(
    cf &&
      (isImmigrationCaseFile(cf) || isCriminalCaseFile(cf) || isFamilyCaseFile(cf)) &&
      cf.timeCritical
  );
}

/**
 * Does this lead warrant the immediate alert and the 30-minute escalation?
 * Personal injury: routed "sign_now" (unchanged). Immigration, criminal
 * defense, and family law: also any time-critical lead, whatever its routing.
 */
export function isHighPriority(cf: AnyCaseFile): boolean {
  return cf.routing === "sign_now" || isTimeCritical(cf);
}
