import type { FamilyDate, FamilyDateTrigger, FamilyHearingType } from "./family-schema";

// ─────────────────────────────────────────────────────────────────────────────
// UNLIKE lib/sol-table.ts, lib/immigration-deadlines.ts, and
// lib/criminal-deadlines.ts, THERE IS NO RULE TABLE HERE.
//
// Those tables work because the underlying window is a federal or
// commonly-cited state rule with a knowable (if variable) range. Family-law
// procedural deadlines — when an Answer is due after service, a temporary-
// orders response window, a modification filing period — are set by each
// state's own family-code and often by local county rule, with ranges that
// swing far wider (days to months) than the other areas' windows. Publishing
// a table anyway would mean guessing a number and letting reviewers treat it
// as authoritative, which is exactly the malpractice risk this product exists
// to avoid.
//
// So for family law, code computes NOTHING from a legal rule. It only does
// date arithmetic on a date the SENDER SAYS THEY WERE ACTUALLY TOLD — a
// hearing date, or a response-due date they were given when served. That is
// why every entry below is `kind: "stated"`, never "computed": it is exactly
// what the sender said, with a day count, not a rule applied to it.
// ─────────────────────────────────────────────────────────────────────────────

/** A lead is time-critical when a safety concern is reported, or a stated date is inside this window. */
export const FAMILY_TIME_CRITICAL_WINDOW_DAYS = 7;

const MS_PER_DAY = 86_400_000;

const HEARING_LABEL: Record<FamilyHearingType, string> = {
  initial: "Initial hearing",
  temporary_orders: "Temporary-orders hearing",
  mediation: "Mediation",
  trial: "Trial",
  other: "Court date",
  unknown: "Court date",
};

/** Whole calendar days from today to a date (negative once passed) — see lib/criminal-deadlines.ts for why calendar days, not elapsed hours. */
function calendarDaysUntil(iso: string, now: Date): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / MS_PER_DAY);
}

function stated(trigger: FamilyDateTrigger, label: string, iso: string, basis: string, now: Date): FamilyDate {
  return { trigger, label, kind: "stated", deadlineISO: iso, daysRemaining: calendarDaysUntil(iso, now), basis };
}

/** The dates the model extracts — only ever a fact the sender actually stated. */
export interface FamilyTriggers {
  nextHearingDate: string | null;
  hearingType: FamilyHearingType;
  responseDueDate: string | null;
}

/**
 * The stated dates, soonest first. There is no "cannot compute, needs X" case
 * here — unlike the other areas, nothing downstream requires a fact strongly
 * enough to prompt for it; a date is either given or it isn't shown at all.
 */
export function computeFamilyDeadlines(
  t: FamilyTriggers,
  now: Date = new Date()
): { deadlines: FamilyDate[]; soonest: FamilyDate | null } {
  const out: FamilyDate[] = [];

  if (t.nextHearingDate) {
    out.push(
      stated(
        "hearing",
        HEARING_LABEL[t.hearingType],
        t.nextHearingDate,
        "The hearing date itself, as told to the sender — verify against the court notice",
        now
      )
    );
  }

  if (t.responseDueDate) {
    out.push(
      stated(
        "response_due",
        "Response due",
        t.responseDueDate,
        "The date the sender says they were told their response is due — verify against the papers served; application code computed no legal window",
        now
      )
    );
  }

  out.sort((a, b) => a.deadlineISO.localeCompare(b.deadlineISO));
  return { deadlines: out, soonest: out[0] ?? null };
}

// ── Time-critical detection ──────────────────────────────────────────────────
// A reported safety concern is a safety issue, not a filing deadline —
// "queue for morning review" is not acceptable regardless of any date. Code,
// not the model, decides. Reasons are coarse categories on purpose: they may
// show before an attorney reviews the practice, and never carry a date.

export interface FamilyTimeCriticalInput {
  safetyConcern: boolean | "unknown";
  deadlines: FamilyDate[];
}

export function computeFamilyTimeCritical(
  input: FamilyTimeCriticalInput
): { timeCritical: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (input.safetyConcern === true) reasons.push("A safety concern was reported");

  if (input.deadlines.some((d) => d.daysRemaining <= FAMILY_TIME_CRITICAL_WINDOW_DAYS)) {
    reasons.push("A hearing or response date is within 7 days or has already passed");
  }

  return { timeCritical: reasons.length > 0, reasons };
}
