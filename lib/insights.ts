// Pure data-shaping for the /insights dashboard. No DB, no React — the page
// queries leads/messages for the firm and hands plain rows in here.

export interface InsightLead {
  id: string;
  channel: string;
  receivedAt: string; // ISO
  routing: string | null; // caseFile.routing, or null if not yet triaged
}

export interface InsightMessage {
  leadId: string;
  approvedAt: string; // ISO — when a human clicked Approve
}

export interface WeekPoint {
  label: string; // "Aug 18"
  value: number | null; // null = no data that week (rendered as a gap, not zero)
}

export interface CategoryCount {
  key: string;
  label: string;
  count: number;
  pct: number; // 0–100, share of the category total
}

const WEEK_MS = 7 * 86_400_000;

function toDate(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}

/** Monday-anchored week start, in UTC so bucketing is stable regardless of server TZ. */
function weekStart(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  s.setUTCDate(s.getUTCDate() + diff);
  return s;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Index of `d`'s week relative to the current week (0 = this week, 1 = last week, …). */
function weekIndex(d: Date, thisWeekStart: Date): number {
  return Math.round((thisWeekStart.getTime() - weekStart(d).getTime()) / WEEK_MS);
}

export function weeklyVolume(
  leads: Pick<InsightLead, "receivedAt">[],
  weeks: number,
  now: Date = new Date()
): WeekPoint[] {
  const thisWeekStart = weekStart(now);
  const counts = new Array<number>(weeks).fill(0);
  for (const lead of leads) {
    const idx = weekIndex(toDate(lead.receivedAt), thisWeekStart);
    if (idx >= 0 && idx < weeks) counts[idx]++;
  }
  const points: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const s = new Date(thisWeekStart.getTime() - i * WEEK_MS);
    points.push({ label: weekLabel(s), value: counts[i] });
  }
  return points;
}

function median(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

/** Hours from a lead's arrival to a human approving its reply, per lead that has one. */
function responseHours(leads: InsightLead[], messages: InsightMessage[]): Map<string, number> {
  const approvedAt = new Map(messages.map((m) => [m.leadId, m.approvedAt]));
  const out = new Map<string, number>();
  for (const lead of leads) {
    const a = approvedAt.get(lead.id);
    if (!a) continue;
    const hours = (toDate(a).getTime() - toDate(lead.receivedAt).getTime()) / 3_600_000;
    if (hours >= 0) out.set(lead.id, hours);
  }
  return out;
}

export function overallMedianResponseHours(
  leads: InsightLead[],
  messages: InsightMessage[]
): number | null {
  const hours = [...responseHours(leads, messages).values()].sort((a, b) => a - b);
  return hours.length ? median(hours) : null;
}

export function weeklyResponseTime(
  leads: InsightLead[],
  messages: InsightMessage[],
  weeks: number,
  now: Date = new Date()
): WeekPoint[] {
  const hoursByLead = responseHours(leads, messages);
  const thisWeekStart = weekStart(now);
  const buckets: number[][] = Array.from({ length: weeks }, () => []);
  for (const lead of leads) {
    const h = hoursByLead.get(lead.id);
    if (h === undefined) continue;
    const idx = weekIndex(toDate(lead.receivedAt), thisWeekStart);
    if (idx >= 0 && idx < weeks) buckets[idx].push(h);
  }
  const points: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const s = new Date(thisWeekStart.getTime() - i * WEEK_MS);
    const vals = buckets[i].sort((a, b) => a - b);
    points.push({ label: weekLabel(s), value: vals.length ? median(vals) : null });
  }
  return points;
}

/** Counts + share for a categorical field (routing, channel, …), sorted descending. */
export function categoryBreakdown(
  values: (string | null)[],
  labels: Record<string, string>
): CategoryCount[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const v of values) {
    if (v === null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: labels[key] ?? key,
      count,
      pct: total ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function fmtHours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${h < 10 ? h.toFixed(1) : Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
