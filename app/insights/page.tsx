import { and, eq, gt, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import AppShell from "@/components/product/AppShell";
import CategoryBarList from "@/components/product/CategoryBarList";
import WeeklyBarChart from "@/components/product/WeeklyBarChart";
import { requireFirmUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import {
  categoryBreakdown,
  fmtHours,
  overallMedianResponseHours,
  weeklyResponseTime,
  weeklyVolume,
  type InsightLead,
} from "@/lib/insights";
import { CHANNEL_LABEL, ROUTING_LABEL } from "@/lib/labels";
import { isDemo } from "@/lib/mode";
import type { CaseFile } from "@/lib/schema";

export const dynamic = "force-dynamic";

const WEEKS = 12;
const WINDOW_DAYS = WEEKS * 7;
const ACTIONABLE_ROUTINGS = new Set(["sign_now", "schedule_consult"]);
const CHANNEL_LABEL_ALL: Record<string, string> = { ...CHANNEL_LABEL, email: "Email" };

const card = "rounded-sm border border-ink-line bg-ink-raised px-5 py-4";
const h2 = "font-display font-bold uppercase tracking-wide text-lg text-paper pb-3";

function StatTile({
  label,
  value,
  tone = "text-manila",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={card}>
      <div className="field-label text-dim">{label}</div>
      <div className={`font-mono font-semibold text-4xl tabular-nums leading-none mt-2 ${tone}`}>
        {value}
      </div>
    </div>
  );
}

export default async function InsightsPage() {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser();
  const db = await getDb();

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const rows = await db
    .select({
      id: tables.leads.id,
      channel: tables.leads.channel,
      receivedAt: tables.leads.receivedAt,
      status: tables.leads.status,
      caseFile: tables.leads.caseFile,
    })
    .from(tables.leads)
    .where(and(eq(tables.leads.firmId, firm.id), gt(tables.leads.receivedAt, since)));

  const leads: InsightLead[] = rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    receivedAt: r.receivedAt,
    routing: r.caseFile ? ((r.caseFile as unknown as CaseFile).routing ?? null) : null,
  }));

  const leadIds = leads.map((l) => l.id);
  const messages = leadIds.length
    ? await db
        .select({ leadId: tables.messages.leadId, approvedAt: tables.messages.approvedAt })
        .from(tables.messages)
        .where(inArray(tables.messages.leadId, leadIds))
    : [];
  const repliedLeadIds = new Set(messages.map((m) => m.leadId));

  const triagedCount = leads.filter((l) => l.routing !== null).length;
  const actionableCount = leads.filter(
    (l) => l.routing !== null && ACTIONABLE_ROUTINGS.has(l.routing)
  ).length;
  const awaitingReview = rows.filter(
    (r) => (r.status === "triaged" && !repliedLeadIds.has(r.id)) || r.status === "needs_attention"
  ).length;

  const medianHours = overallMedianResponseHours(leads, messages);
  const volumePoints = weeklyVolume(leads, WEEKS);
  const responsePoints = weeklyResponseTime(leads, messages, WEEKS);
  const routingBreakdown = categoryBreakdown(
    leads.map((l) => l.routing),
    ROUTING_LABEL
  );
  const channelMix = categoryBreakdown(
    leads.map((l) => l.channel),
    CHANNEL_LABEL_ALL
  );

  return (
    <AppShell user={user} firm={firm}>
      <div className="px-6 pt-4 pb-10 max-w-[1200px] mx-auto">
        <div className="flex items-baseline justify-between pb-1">
          <h1 className="font-display font-bold uppercase tracking-wide text-2xl text-paper">
            Insights
          </h1>
          <span className="field-label text-dim">last {WEEKS} weeks</span>
        </div>
        <p className="text-dim text-[15px] pb-4">
          How {firm.name} is doing since {new Date(since).toISOString().slice(0, 10)}.
        </p>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <StatTile label="Leads" value={String(leads.length)} />
          <StatTile
            label="Awaiting review"
            value={String(awaitingReview)}
            tone={awaitingReview > 0 ? "text-meter" : "text-ok"}
          />
          <StatTile
            label="Sign-now / consult rate"
            value={triagedCount ? `${Math.round((100 * actionableCount) / triagedCount)}%` : "—"}
          />
          <StatTile
            label="Median time to reply"
            value={medianHours !== null ? fmtHours(medianHours) : "—"}
          />
        </div>

        {leads.length === 0 ? (
          <div className="rounded-sm border border-ink-line bg-ink-raised px-6 py-14 text-center">
            <div className="font-display uppercase tracking-widest text-dim text-xl">
              Nothing to show yet
            </div>
            <p className="text-dim mt-2 text-[15px] max-w-md mx-auto">
              Charts fill in once inquiries start arriving — check back after your first few
              leads.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className={`${card} col-span-2`}>
              <h2 className={h2}>Leads per week</h2>
              <WeeklyBarChart
                points={volumePoints}
                color="var(--manila)"
                valueKind="count"
                unitLabel="leads"
              />
            </div>

            <div className={card}>
              <h2 className={h2}>Routing breakdown</h2>
              <CategoryBarList items={routingBreakdown} />
              {leads.length > triagedCount && (
                <p className="text-dim text-xs mt-3">
                  {leads.length - triagedCount} lead{leads.length - triagedCount === 1 ? "" : "s"}{" "}
                  still processing or flagged for attention, not counted here.
                </p>
              )}
            </div>

            <div className={card}>
              <h2 className={h2}>Channel mix</h2>
              <CategoryBarList items={channelMix} />
            </div>

            <div className={`${card} col-span-2`}>
              <h2 className={h2}>Time to reply, per week</h2>
              <WeeklyBarChart
                points={responsePoints}
                color="var(--meter)"
                valueKind="medianHours"
                emptyLabel="no replies that week"
              />
              <p className="text-dim text-xs mt-2">
                From when a lead arrives to when a human approves its reply — not delivery time.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
