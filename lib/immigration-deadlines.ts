import type {
  CurrentStatus,
  DeadlineTrigger,
  ImmigrationCaseType,
  ImmigrationDeadline,
  NoticeType,
} from "./immigration-schema";

// ─────────────────────────────────────────────────────────────────────────────
// ILLUSTRATIVE DATA — NOT LEGAL REFERENCE MATERIAL.
//
// Same architecture as lib/sol-table.ts: the AI model extracts trigger FACTS
// (a notice type and its date, a hearing date, a status expiration date, a
// last-entry date) and THIS CODE does the arithmetic from a human-maintained
// table. The model never states a deadline.
//
// The entries below are simplified and are NOT reviewed law. Real immigration
// deadlines carry rules this table ignores entirely: the due date printed on
// the notice itself controls for USCIS requests; mailing and service rules;
// weekend and holiday roll-forward; equitable tolling; exceptions to the
// one-year asylum bar (changed or extraordinary circumstances); exceptions to
// the motion-to-reopen deadline; and the many forms and appeals not listed
// here. Every citation must be verified by an attorney against current law.
// Deadlines stay hidden from reviewers until an attorney at the firm reviews
// this table and acknowledges it in Settings.
// ─────────────────────────────────────────────────────────────────────────────

/** A lead is time-critical when anything is due, or a person may be held, inside this window. */
export const TIME_CRITICAL_WINDOW_DAYS = 14;

interface DayRule {
  days: number;
  /** Documented, but deliberately NOT added to the computed date (earlier date wins). */
  mailingAllowanceDays?: number;
  basis: string;
}

export const IMMIGRATION_RULES = {
  rfe: {
    days: 84,
    mailingAllowanceDays: 3,
    basis:
      "Request for Evidence — up to 12 weeks (84 days) from the notice date; +3 days if served by mail (8 CFR § 103.2(b)(8), § 103.8(b)) (illustrative; verify — the notice's own due date controls)",
  },
  noid: {
    days: 30,
    mailingAllowanceDays: 3,
    basis:
      "Notice of Intent to Deny — 30 days from the notice date; +3 days if served by mail (8 CFR § 103.2(b)(8), § 103.8(b)) (illustrative; verify — the notice's own due date controls)",
  },
  biaAppeal: {
    days: 30,
    basis:
      "Appeal of an immigration judge decision to the BIA — 30 days from the decision (8 CFR § 1003.38(b)) (illustrative; verify)",
  },
  motionToReopen: {
    days: 90,
    basis:
      "Motion to reopen — 90 days from the final order (8 CFR § 1003.2(c), § 1003.23(b)) (illustrative; verify — exceptions exist)",
  },
} as const satisfies Record<string, DayRule>;

const ASYLUM_BAR = {
  months: 12,
  basis:
    "One-year asylum filing bar — one year from last arrival (INA § 208(a)(2)(B)) (illustrative; verify — exceptions exist)",
} as const;

const MS_PER_DAY = 86_400_000;

function addDaysUTC(iso: string, days: number): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days));
}

function addMonthsUTC(iso: string, months: number): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d));
}

function asDeadline(
  trigger: DeadlineTrigger,
  label: string,
  date: Date,
  basis: string,
  now: Date,
  mailingAllowanceDays?: number
): ImmigrationDeadline {
  return {
    trigger,
    label,
    kind: "computed",
    deadlineISO: date.toISOString().slice(0, 10),
    daysRemaining: Math.floor((date.getTime() - now.getTime()) / MS_PER_DAY),
    basis,
    ...(mailingAllowanceDays !== undefined ? { mailingAllowanceDays } : {}),
  };
}

function needs(trigger: DeadlineTrigger, label: string, missing: string): ImmigrationDeadline {
  return {
    trigger,
    label,
    kind: "needs_trigger",
    deadlineISO: null,
    daysRemaining: null,
    basis: `Cannot compute — needs ${missing}`,
  };
}

/** The trigger facts the model extracts. Dates are ISO (YYYY-MM-DD) or null. */
export interface ImmigrationTriggers {
  caseType: ImmigrationCaseType;
  currentStatus: CurrentStatus;
  statusExpirationDate: string | null;
  lastEntryDate: string | null;
  noticeType: NoticeType;
  noticeDate: string | null;
  inRemovalProceedings: boolean | "unknown";
  nextHearingDate: string | null;
  ijDecisionDate: string | null;
}

/**
 * Every deadline that can be worked out from the triggers, soonest first, then
 * one "needs X" entry per rule that plainly applies but is missing its fact.
 * A rule that doesn't apply produces nothing. Nothing is ever guessed.
 */
export function computeImmigrationDeadlines(
  t: ImmigrationTriggers,
  now: Date = new Date()
): { deadlines: ImmigrationDeadline[]; soonest: ImmigrationDeadline | null } {
  const out: ImmigrationDeadline[] = [];

  if (t.noticeType === "rfe") {
    out.push(
      t.noticeDate
        ? asDeadline(
            "rfe",
            "Response to Request for Evidence",
            addDaysUTC(t.noticeDate, IMMIGRATION_RULES.rfe.days),
            IMMIGRATION_RULES.rfe.basis,
            now,
            IMMIGRATION_RULES.rfe.mailingAllowanceDays
          )
        : needs("rfe", "Response to Request for Evidence", "the RFE notice date")
    );
  }

  if (t.noticeType === "noid") {
    out.push(
      t.noticeDate
        ? asDeadline(
            "noid",
            "Response to Notice of Intent to Deny",
            addDaysUTC(t.noticeDate, IMMIGRATION_RULES.noid.days),
            IMMIGRATION_RULES.noid.basis,
            now,
            IMMIGRATION_RULES.noid.mailingAllowanceDays
          )
        : needs("noid", "Response to Notice of Intent to Deny", "the NOID notice date")
    );
  }

  if (t.ijDecisionDate) {
    out.push(
      asDeadline(
        "bia_appeal",
        "BIA appeal of immigration judge decision",
        addDaysUTC(t.ijDecisionDate, IMMIGRATION_RULES.biaAppeal.days),
        IMMIGRATION_RULES.biaAppeal.basis,
        now
      ),
      asDeadline(
        "motion_to_reopen",
        "Motion to reopen",
        addDaysUTC(t.ijDecisionDate, IMMIGRATION_RULES.motionToReopen.days),
        IMMIGRATION_RULES.motionToReopen.basis,
        now
      )
    );
  }

  if (t.caseType === "asylum_humanitarian") {
    out.push(
      t.lastEntryDate
        ? asDeadline(
            "asylum_one_year",
            "One-year asylum filing bar",
            addMonthsUTC(t.lastEntryDate, ASYLUM_BAR.months),
            ASYLUM_BAR.basis,
            now
          )
        : needs("asylum_one_year", "One-year asylum filing bar", "the date of last arrival")
    );
  }

  if (t.statusExpirationDate) {
    out.push(
      asDeadline(
        "status_expiration",
        "Current status expires",
        addDaysUTC(t.statusExpirationDate, 0),
        "The status expiration date itself (illustrative; verify against the person's documents)",
        now
      )
    );
  } else if (t.currentStatus === "visa_holder") {
    out.push(needs("status_expiration", "Current status expires", "the status expiration date"));
  }

  if (t.nextHearingDate) {
    out.push(
      asDeadline(
        "hearing",
        "Scheduled hearing",
        addDaysUTC(t.nextHearingDate, 0),
        "The hearing date itself (illustrative; verify against the hearing notice)",
        now
      )
    );
  } else if (t.inRemovalProceedings === true) {
    out.push(needs("hearing", "Scheduled hearing", "the next hearing date"));
  }

  const computed = out
    .filter((d) => d.kind === "computed")
    .sort((a, b) => (a.deadlineISO as string).localeCompare(b.deadlineISO as string));
  const missing = out.filter((d) => d.kind === "needs_trigger");
  const deadlines = [...computed, ...missing];
  return { deadlines, soonest: computed[0] ?? null };
}

// ── Time-critical detection ──────────────────────────────────────────────────
// Immigration intake can involve a detained person or an imminent hearing —
// a liberty issue, so "queue for morning review" is not acceptable. Code, not
// the model, decides. Reasons are coarse categories on purpose: they may be
// shown before an attorney acknowledges the deadline table, so they never
// carry a date or a day count.

export interface TimeCriticalInput {
  isDetained: boolean | "unknown";
  nextHearingDate: string | null;
  noticeType: NoticeType;
  deadlines: ImmigrationDeadline[];
}

export function computeTimeCritical(
  input: TimeCriticalInput,
  now: Date = new Date()
): { timeCritical: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (input.isDetained === true) {
    reasons.push("Person may be detained");
  }

  if (input.nextHearingDate) {
    const [y, m, d] = input.nextHearingDate.split("-").map(Number);
    const daysToHearing = Math.floor((Date.UTC(y, m - 1, d) - now.getTime()) / MS_PER_DAY);
    if (daysToHearing <= TIME_CRITICAL_WINDOW_DAYS) {
      reasons.push("Hearing is within 14 days or has already passed");
    }
  }

  if (
    input.deadlines.some(
      (d) =>
        d.kind === "computed" &&
        d.trigger !== "hearing" && // already covered above
        d.daysRemaining !== null &&
        d.daysRemaining <= TIME_CRITICAL_WINDOW_DAYS
    )
  ) {
    reasons.push("A computed deadline is within 14 days or past due");
  }

  if (input.noticeType === "nta" && !input.nextHearingDate) {
    reasons.push("Notice to Appear received and no hearing date is known");
  }

  return { timeCritical: reasons.length > 0, reasons };
}
