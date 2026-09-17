import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import AppShell from "@/components/product/AppShell";
import TrendBarChart from "@/components/product/TrendBarChart";
import MarketingTable, { type MarketingTableRow } from "@/components/product/MarketingTable";
import { isMarketingViewer, requireFirmUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import {
  marketingSummary,
  marketingTrend,
  paymentStatus,
  trialStatus,
  type FirmMarketingRow,
  type Granularity,
} from "@/lib/marketing";
import { isDemo } from "@/lib/mode";

export const dynamic = "force-dynamic";

const DEFAULT_RANGE_DAYS = 90;
const GRANULARITIES: Granularity[] = ["day", "week", "month"];

const card = "rounded-sm border border-ink-line bg-ink-raised px-5 py-4";
const h2 = "font-display font-bold uppercase tracking-wide text-lg text-paper pb-3";
const input =
  "rounded-sm border border-ink-line bg-ink px-2 py-1 text-sm font-mono text-inktext focus:outline focus:outline-2 focus:outline-meter";

function StatTile({ label, value, tone = "text-manila" }: { label: string; value: string; tone?: string }) {
  return (
    <div className={card}>
      <div className="field-label text-dim">{label}</div>
      <div className={`font-mono font-semibold text-4xl tabular-nums leading-none mt-2 ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function MarketingDashboard({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; bucket?: string }>;
}) {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser();
  if (!isMarketingViewer(user)) redirect("/");

  const params = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - DEFAULT_RANGE_DAYS * 86_400_000);
  const fromStr = params.from && !Number.isNaN(Date.parse(params.from)) ? params.from : isoDate(defaultFrom);
  const toStr = params.to && !Number.isNaN(Date.parse(params.to)) ? params.to : isoDate(now);
  const from = new Date(`${fromStr}T00:00:00Z`);
  const to = new Date(`${toStr}T23:59:59Z`);
  const bucket: Granularity = GRANULARITIES.includes(params.bucket as Granularity)
    ? (params.bucket as Granularity)
    : "week";

  const db = await getDb();

  // Cross-firm by design — this is the one dashboard meant to see every
  // tenant at once. Every other page in the app scopes by firmId.
  const firmRows = await db
    .select({
      id: tables.firms.id,
      name: tables.firms.name,
      slug: tables.firms.slug,
      createdAt: tables.firms.createdAt,
      convertedAt: tables.firms.convertedAt,
      trialEndsAt: tables.firms.trialEndsAt,
      subscriptionStatus: tables.firms.subscriptionStatus,
    })
    .from(tables.firms);

  const adminRows = await db
    .select({ firmId: tables.users.firmId, email: tables.users.email })
    .from(tables.users)
    .where(eq(tables.users.role, "admin"))
    .orderBy(tables.users.id);
  const contactByFirm = new Map<number, string>();
  for (const a of adminRows) {
    if (!contactByFirm.has(a.firmId)) contactByFirm.set(a.firmId, a.email);
  }

  const all: FirmMarketingRow[] = firmRows;
  const cohort = all.filter((f) => {
    const t = new Date(f.createdAt).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });

  const summary = marketingSummary(cohort);
  const trendPoints = marketingTrend(all, from, to, bucket);

  const tableRows: MarketingTableRow[] = cohort
    .map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      contactEmail: contactByFirm.get(f.id) ?? null,
      createdAt: f.createdAt,
      trial: trialStatus(f.trialEndsAt),
      payment: paymentStatus(f.convertedAt),
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <AppShell user={user} firm={firm}>
      <div className="px-6 pt-4 pb-10 max-w-[1200px] mx-auto">
        <div className="flex items-baseline justify-between pb-1">
          <h1 className="font-display font-bold uppercase tracking-wide text-2xl text-paper">
            Marketing
          </h1>
        </div>
        <p className="text-dim text-[15px] pb-4">
          Firm registrations and trial-to-paid conversion, platform-wide. Commissions are decided
          manually — this is visibility only.
        </p>

        <form className="flex flex-wrap items-end gap-3 pb-4" method="get">
          <label className="flex flex-col gap-1">
            <span className="field-label text-dim">From</span>
            <input type="date" name="from" defaultValue={fromStr} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label text-dim">To</span>
            <input type="date" name="to" defaultValue={toStr} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label text-dim">Group by</span>
            <select name="bucket" defaultValue={bucket} className={input}>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
          <button className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider px-4 py-1.5 hover:bg-manila-deep">
            Apply
          </button>
        </form>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatTile label="Total registrations" value={String(summary.totalRegistrations)} />
          <StatTile label="Total paid users" value={String(summary.totalPaid)} tone="text-ok" />
          <StatTile
            label="Conversion rate"
            value={summary.conversionRatePct !== null ? `${summary.conversionRatePct}%` : "—"}
          />
        </div>
        <p className="text-dim text-xs pb-4">
          Registered {fromStr} – {toStr}. &ldquo;Paid&rdquo; means the firm has ever converted from
          trial to a subscription, regardless of current status.
        </p>

        <div className={`${card} mb-4`}>
          <h2 className={h2}>Registrations vs. paid conversions</h2>
          {trendPoints.length > 0 ? (
            <TrendBarChart points={trendPoints} />
          ) : (
            <p className="text-dim text-sm">No data in this range.</p>
          )}
        </div>

        <div className={card}>
          <h2 className={h2}>Firms</h2>
          <MarketingTable rows={tableRows} />
        </div>
      </div>
    </AppShell>
  );
}
