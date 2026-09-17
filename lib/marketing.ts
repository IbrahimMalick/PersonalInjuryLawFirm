// Pure data-shaping for the /marketing dashboard. No DB, no React — the page
// queries firms and hands plain rows in here. Mirrors lib/insights.ts.

export type Granularity = "day" | "week" | "month";

export interface FirmMarketingRow {
  id: number;
  name: string;
  slug: string;
  createdAt: string; // ISO — registration (trial start)
  convertedAt: string | null; // ISO — first time this firm ever paid
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
}

export interface TrendPoint {
  label: string;
  registrations: number;
  conversions: number;
}

function toDate(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}

function bucketStart(d: Date, granularity: Granularity): Date {
  if (granularity === "day") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  if (granularity === "month") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  // week: Monday-anchored, UTC — same convention as lib/insights.ts
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  s.setUTCDate(s.getUTCDate() + diff);
  return s;
}

function bucketKey(d: Date, granularity: Granularity): string {
  return bucketStart(d, granularity).toISOString().slice(0, 10);
}

function bucketLabel(key: string, granularity: Granularity): string {
  const d = new Date(`${key}T00:00:00Z`);
  if (granularity === "month") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function advance(d: Date, granularity: Granularity): Date {
  const next = new Date(d);
  if (granularity === "day") next.setUTCDate(next.getUTCDate() + 1);
  else if (granularity === "week") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

const MAX_BUCKETS = 366; // guard against a huge range + "day" granularity

/**
 * Registrations and conversions per bucket across [from, to] (inclusive
 * dates). Every bucket in range is present — zero-filled, not gapped — since
 * unlike the rolling Insights window this range is fully known.
 */
export function marketingTrend(
  rows: Pick<FirmMarketingRow, "createdAt" | "convertedAt">[],
  from: Date,
  to: Date,
  granularity: Granularity
): TrendPoint[] {
  const start = bucketStart(from, granularity);
  const end = bucketStart(to, granularity);
  const keys: string[] = [];
  for (let cur = start; cur.getTime() <= end.getTime() && keys.length < MAX_BUCKETS; cur = advance(cur, granularity)) {
    keys.push(bucketKey(cur, granularity));
  }
  const index = new Map(keys.map((k, i) => [k, i]));
  const regs = new Array(keys.length).fill(0);
  const convs = new Array(keys.length).fill(0);
  for (const r of rows) {
    const rKey = bucketKey(toDate(r.createdAt), granularity);
    const i = index.get(rKey);
    if (i !== undefined) regs[i]++;
    if (r.convertedAt) {
      const cKey = bucketKey(toDate(r.convertedAt), granularity);
      const j = index.get(cKey);
      if (j !== undefined) convs[j]++;
    }
  }
  return keys.map((k, i) => ({
    label: bucketLabel(k, granularity),
    registrations: regs[i],
    conversions: convs[i],
  }));
}

export interface MarketingSummary {
  totalRegistrations: number;
  totalPaid: number;
  conversionRatePct: number | null;
}

/** Of the firms in `rows` (already date-range filtered by registration), how many have ever paid? */
export function marketingSummary(rows: Pick<FirmMarketingRow, "convertedAt">[]): MarketingSummary {
  const totalRegistrations = rows.length;
  const totalPaid = rows.filter((r) => r.convertedAt !== null).length;
  return {
    totalRegistrations,
    totalPaid,
    conversionRatePct: totalRegistrations
      ? Math.round((1000 * totalPaid) / totalRegistrations) / 10
      : null,
  };
}

export type TrialStatus = "active" | "expired";
export type PaymentStatus = "paid" | "unpaid";

export function trialStatus(trialEndsAt: string | null, now: Date = new Date()): TrialStatus {
  return trialEndsAt && toDate(trialEndsAt).getTime() > now.getTime() ? "active" : "expired";
}

export function paymentStatus(convertedAt: string | null): PaymentStatus {
  return convertedAt ? "paid" : "unpaid";
}
