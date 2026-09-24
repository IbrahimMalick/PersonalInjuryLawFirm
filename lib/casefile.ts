import type { ImmigrationCaseFile } from "./immigration-schema";
import { CASE_TYPE_LABEL, IMMIGRATION_CASE_TYPE_LABEL } from "./labels";
import type { CaseFile, PracticeArea } from "./schema";

// A stored case file is one of two shapes, told apart by `practiceArea`. Every
// case file written before practice areas existed has no such field and is
// personal injury. Consumers that don't care which shape they have use these
// helpers; consumers that do care narrow with isImmigrationCaseFile — never
// `any`.

export type AnyCaseFile = CaseFile | ImmigrationCaseFile;

export function isImmigrationCaseFile(cf: AnyCaseFile): cf is ImmigrationCaseFile {
  return cf.practiceArea === "immigration";
}

export function practiceAreaOf(cf: AnyCaseFile): PracticeArea {
  return isImmigrationCaseFile(cf) ? "immigration" : "personal_injury";
}

export interface CaseContact {
  name: string | null;
  phone: string | null;
  email: string | null;
  preferredLanguage: string | null;
}

/** The person who wrote in — `claimant` for personal injury, `applicant` for immigration. */
export function contactOf(cf: AnyCaseFile): CaseContact {
  const c = isImmigrationCaseFile(cf) ? cf.applicant : cf.claimant;
  return {
    name: c.name,
    phone: c.phone,
    email: c.email,
    preferredLanguage: c.preferredLanguage,
  };
}

export function caseTypeLabelOf(cf: AnyCaseFile): string {
  return isImmigrationCaseFile(cf)
    ? IMMIGRATION_CASE_TYPE_LABEL[cf.caseType]
    : CASE_TYPE_LABEL[cf.caseType];
}

export function isTimeCritical(cf: AnyCaseFile | null | undefined): boolean {
  return Boolean(cf && isImmigrationCaseFile(cf) && cf.timeCritical);
}

/**
 * Does this lead warrant the immediate alert and the 30-minute escalation?
 * Personal injury: routed "sign_now" (unchanged). Immigration: also any
 * time-critical lead, whatever its routing.
 */
export function isHighPriority(cf: AnyCaseFile): boolean {
  return cf.routing === "sign_now" || isTimeCritical(cf);
}
