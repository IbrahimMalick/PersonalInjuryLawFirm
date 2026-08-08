import type { CaseType, StatuteOfLimitations } from "./schema";

// ─────────────────────────────────────────────────────────────────────────────
// ILLUSTRATIVE DEMO DATA — NOT LEGAL REFERENCE MATERIAL.
//
// This table exists to demonstrate an architecture: the AI model extracts the
// incident date and jurisdiction, and THIS CODE does the deadline arithmetic
// from a human-maintained table. The model never generates a filing deadline.
//
// The entries below are simplified. Real statutes of limitations carry
// exceptions this table ignores entirely: discovery rules, tolling for minors,
// notice-of-claim deadlines against municipalities (as short as 90 days in NY),
// wrongful-death clocks, and more. A production system would source this table
// from counsel-verified data and re-verify on every legislative session.
// Verify against official sources, e.g. https://www.nysenate.gov/legislation
// ─────────────────────────────────────────────────────────────────────────────

interface SolRule {
  months: number; // limitations period in months from date of incident
  basis: string; // plain-cite for the demo UI
}

const SOL_TABLE: Record<string, Partial<Record<CaseType, SolRule>>> = {
  NY: {
    motor_vehicle: { months: 36, basis: "NY CPLR § 214(4)-(5) — 3 years (illustrative; verify)" },
    premises_liability: { months: 36, basis: "NY CPLR § 214(5) — 3 years (illustrative; verify)" },
    dog_bite: { months: 36, basis: "NY CPLR § 214(5) — 3 years (illustrative; verify)" },
    product_liability: { months: 36, basis: "NY CPLR § 214(5) — 3 years (illustrative; verify)" },
    medical_malpractice: { months: 30, basis: "NY CPLR § 214-a — 2.5 years (illustrative; verify)" },
    workers_comp: { months: 24, basis: "NY WCL § 28 — 2-year claim window (illustrative; verify)" },
  },
  NJ: {
    motor_vehicle: { months: 24, basis: "N.J.S.A. 2A:14-2 — 2 years (illustrative; verify)" },
    premises_liability: { months: 24, basis: "N.J.S.A. 2A:14-2 — 2 years (illustrative; verify)" },
    dog_bite: { months: 24, basis: "N.J.S.A. 2A:14-2 — 2 years (illustrative; verify)" },
    product_liability: { months: 24, basis: "N.J.S.A. 2A:14-2 — 2 years (illustrative; verify)" },
    medical_malpractice: { months: 24, basis: "N.J.S.A. 2A:14-2 — 2 years (illustrative; verify)" },
  },
  CT: {
    motor_vehicle: { months: 24, basis: "Conn. Gen. Stat. § 52-584 — 2 years (illustrative; verify)" },
    premises_liability: { months: 24, basis: "Conn. Gen. Stat. § 52-584 — 2 years (illustrative; verify)" },
    dog_bite: { months: 24, basis: "Conn. Gen. Stat. § 52-584 — 2 years (illustrative; verify)" },
  },
  PA: {
    motor_vehicle: { months: 24, basis: "42 Pa.C.S. § 5524 — 2 years (illustrative; verify)" },
    premises_liability: { months: 24, basis: "42 Pa.C.S. § 5524 — 2 years (illustrative; verify)" },
    dog_bite: { months: 24, basis: "42 Pa.C.S. § 5524 — 2 years (illustrative; verify)" },
  },
  FL: {
    motor_vehicle: { months: 24, basis: "Fla. Stat. § 95.11(4)(a) — 2 years (illustrative; verify)" },
    premises_liability: { months: 24, basis: "Fla. Stat. § 95.11(4)(a) — 2 years (illustrative; verify)" },
    dog_bite: { months: 24, basis: "Fla. Stat. § 95.11(4)(a) — 2 years (illustrative; verify)" },
  },
};

function addMonthsUTC(iso: string, months: number): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date;
}

export function computeSOL(
  incidentDate: string | null,
  jurisdiction: string | null,
  caseType: CaseType,
  now: Date = new Date()
): StatuteOfLimitations {
  if (!incidentDate) {
    return {
      jurisdiction,
      deadlineISO: null,
      daysRemaining: null,
      basis: "Cannot compute — incident date not yet confirmed",
    };
  }
  const state = jurisdiction?.toUpperCase() ?? null;
  const rule = state ? SOL_TABLE[state]?.[caseType] : undefined;
  if (!state || !rule) {
    return {
      jurisdiction: state,
      deadlineISO: null,
      daysRemaining: null,
      basis: state
        ? `No table entry for ${state}/${caseType} — attorney review required`
        : "Cannot compute — jurisdiction not yet confirmed",
    };
  }
  const deadline = addMonthsUTC(incidentDate, rule.months);
  const deadlineISO = deadline.toISOString().slice(0, 10);
  const msPerDay = 86_400_000;
  const daysRemaining = Math.floor((deadline.getTime() - now.getTime()) / msPerDay);
  return { jurisdiction: state, deadlineISO, daysRemaining, basis: rule.basis };
}
