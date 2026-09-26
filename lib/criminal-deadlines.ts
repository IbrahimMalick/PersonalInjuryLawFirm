import type {
  CaseStage,
  CriminalCaseType,
  CriminalDeadline,
  CriminalDeadlineTrigger,
  HearingType,
} from "./criminal-schema";

// ─────────────────────────────────────────────────────────────────────────────
// ILLUSTRATIVE DATA — NOT LEGAL REFERENCE MATERIAL.
//
// Same architecture as lib/sol-table.ts and lib/immigration-deadlines.ts: the
// AI model extracts trigger FACTS (a court date, an arrest date, a conviction
// date) and THIS CODE does the arithmetic from a human-maintained table. The
// model never states a deadline.
//
// Criminal deadlines are mostly court dates, which need no arithmetic. The two
// windows below are the ones that most often decide a case and they VARY
// WIDELY BY STATE AND COURT: appeal windows range from about two weeks (federal
// courts) to a month or more, and DUI license-suspension hearing requests range
// from about a week to a month. Where the law differs, this table uses the
// SHORTER window on purpose — showing a deadline that is too early is a false
// alarm; showing one that is too late is a missed appeal. Both need an
// attorney's review for the firm's actual jurisdiction. Deadlines stay hidden
// from reviewers until an attorney at the firm acknowledges the table.
// ─────────────────────────────────────────────────────────────────────────────

/** A lead is time-critical when anyone may be held, or anything is due, inside this window. */
export const CRIMINAL_TIME_CRITICAL_WINDOW_DAYS = 7;

export const CRIMINAL_RULES = {
  noticeOfAppealDays: 14,
  licenseHearingRequestDays: 7,
} as const;

const APPEAL_BASIS =
  "Notice of appeal after a conviction — 14 days from judgment, the shortest common window (federal courts; many states allow 30 or more) (illustrative; verify for the jurisdiction)";
const LICENSE_BASIS =
  "Request for a DUI license-suspension hearing — 7 days from arrest, the shortest common window (states range from about a week to a month) (illustrative; verify for the jurisdiction)";

const MS_PER_DAY = 86_400_000;

/**
 * Whole calendar days from today to a date (negative once passed). Court dates
 * and deadlines are calendar dates, not instants: a hearing today is 0 days
 * away — not "passed" half way through the day. Counted in UTC, so a firm far
 * from UTC can be a day off around midnight; the alert errs early, never late.
 */
function calendarDaysUntil(date: Date, now: Date): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - today) / MS_PER_DAY);
}

const HEARING_LABEL: Record<HearingType, string> = {
  arraignment: "Arraignment",
  bail: "Bail hearing",
  preliminary: "Preliminary hearing",
  trial: "Trial",
  sentencing: "Sentencing",
  probation_violation: "Probation-violation hearing",
  other: "Court date",
  unknown: "Court date",
};

function addDaysUTC(iso: string, days: number): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days));
}

function computed(
  trigger: CriminalDeadlineTrigger,
  label: string,
  date: Date,
  basis: string,
  now: Date
): CriminalDeadline {
  return {
    trigger,
    label,
    kind: "computed",
    deadlineISO: date.toISOString().slice(0, 10),
    daysRemaining: calendarDaysUntil(date, now),
    basis,
  };
}

function needs(trigger: CriminalDeadlineTrigger, label: string, missing: string): CriminalDeadline {
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
export interface CriminalTriggers {
  caseType: CriminalCaseType;
  inCustody: boolean | "unknown";
  arrestDate: string | null;
  nextCourtDate: string | null;
  hearingType: HearingType;
  caseStage: CaseStage;
  convictionDate: string | null;
}

/**
 * Every deadline that can be worked out, soonest first, then one "needs X"
 * entry per rule that plainly applies but is missing its fact. A rule that
 * doesn't apply produces nothing. Nothing is ever guessed.
 */
export function computeCriminalDeadlines(
  t: CriminalTriggers,
  now: Date = new Date()
): { deadlines: CriminalDeadline[]; soonest: CriminalDeadline | null } {
  const out: CriminalDeadline[] = [];

  if (t.nextCourtDate) {
    out.push(
      computed(
        "court_date",
        HEARING_LABEL[t.hearingType],
        addDaysUTC(t.nextCourtDate, 0),
        "The court date itself (illustrative; verify against the court notice)",
        now
      )
    );
  } else if (t.inCustody === true) {
    out.push(needs("court_date", "Next court date", "the next court date"));
  }

  if (t.convictionDate) {
    out.push(
      computed(
        "notice_of_appeal",
        "Notice of appeal",
        addDaysUTC(t.convictionDate, CRIMINAL_RULES.noticeOfAppealDays),
        APPEAL_BASIS,
        now
      )
    );
  } else if (t.caseStage === "post_conviction") {
    out.push(needs("notice_of_appeal", "Notice of appeal", "the conviction or judgment date"));
  }

  if (t.caseType === "dui_dwi") {
    out.push(
      t.arrestDate
        ? computed(
            "license_hearing_request",
            "DUI license-hearing request",
            addDaysUTC(t.arrestDate, CRIMINAL_RULES.licenseHearingRequestDays),
            LICENSE_BASIS,
            now
          )
        : needs("license_hearing_request", "DUI license-hearing request", "the arrest date")
    );
  }

  const done = out
    .filter((d) => d.kind === "computed")
    .sort((a, b) => (a.deadlineISO as string).localeCompare(b.deadlineISO as string));
  const missing = out.filter((d) => d.kind === "needs_trigger");
  return { deadlines: [...done, ...missing], soonest: done[0] ?? null };
}

// ── Time-critical detection ──────────────────────────────────────────────────
// A person in custody, an imminent court date, or an active warrant is a
// liberty issue — "queue for morning review" is not acceptable. Code, not the
// model, decides. Reasons are coarse categories on purpose: they may show
// before an attorney acknowledges the table, so they never carry a date.

export interface CriminalTimeCriticalInput {
  inCustody: boolean | "unknown";
  hasActiveWarrant: boolean | "unknown";
  nextCourtDate: string | null;
  deadlines: CriminalDeadline[];
}

export function computeCriminalTimeCritical(
  input: CriminalTimeCriticalInput,
  now: Date = new Date()
): { timeCritical: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (input.inCustody === true) reasons.push("Person may be in custody");
  if (input.hasActiveWarrant === true) reasons.push("An active warrant was reported");

  if (input.nextCourtDate) {
    const [y, m, d] = input.nextCourtDate.split("-").map(Number);
    const days = calendarDaysUntil(new Date(Date.UTC(y, m - 1, d)), now);
    if (days <= CRIMINAL_TIME_CRITICAL_WINDOW_DAYS) {
      reasons.push("Court date is within 7 days or has already passed");
    }
  }

  if (
    input.deadlines.some(
      (d) =>
        d.kind === "computed" &&
        d.trigger !== "court_date" && // already covered above
        d.daysRemaining !== null &&
        d.daysRemaining <= CRIMINAL_TIME_CRITICAL_WINDOW_DAYS
    )
  ) {
    reasons.push("A computed deadline is within 7 days or past due");
  }

  return { timeCritical: reasons.length > 0, reasons };
}
