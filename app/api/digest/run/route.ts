import { and, eq, gt, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { firmRecipients } from "@/lib/alerts";
import { getDb, tables } from "@/lib/db";
import { baseUrl, sendPlatformEmail } from "@/lib/email";
import {
  fmtHours,
  weeklyDigestSummary,
  type DigestLeadRow,
  type InsightMessage,
  type WeeklyDigestSummary,
} from "@/lib/insights";
import type { AnyCaseFile } from "@/lib/casefile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Weekly cron (see vercel.json) — turns Insights from "something you check"
// into "something that reaches you". Same CRON_SECRET auth as /api/jobs/run.

const DIGEST_WINDOW_DAYS = 7;
// If the cron fires twice for any reason, don't re-send the same week.
const MIN_RESEND_GAP_HOURS = 72;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function digestBody(firmName: string, s: WeeklyDigestSummary): string {
  const repliedPct = s.triagedCount ? Math.round((100 * s.repliedCount) / s.triagedCount) : null;
  return [
    `Here's what happened at ${firmName} in the last ${DIGEST_WINDOW_DAYS} days.`,
    "",
    `${s.totalLeads} new lead${s.totalLeads === 1 ? "" : "s"}`,
    `${s.signNowCount} routed Sign Now`,
    repliedPct !== null ? `${repliedPct}% of triaged leads replied to` : null,
    s.medianReplyHours !== null ? `Median time to reply: ${fmtHours(s.medianReplyHours)}` : null,
    s.needsAttentionCount > 0
      ? `${s.needsAttentionCount} still need${s.needsAttentionCount === 1 ? "s" : ""} attention`
      : null,
    "",
    `Full breakdown: ${baseUrl()}/insights`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const since = new Date(Date.now() - DIGEST_WINDOW_DAYS * 86_400_000).toISOString();
  const resendCutoff = new Date(Date.now() - MIN_RESEND_GAP_HOURS * 3_600_000).toISOString();

  const firms = await db.select().from(tables.firms);
  let sent = 0;
  let skipped = 0;

  for (const firm of firms) {
    if (firm.lastDigestSentAt && firm.lastDigestSentAt > resendCutoff) {
      skipped++;
      continue;
    }

    const rows = await db
      .select({
        id: tables.leads.id,
        receivedAt: tables.leads.receivedAt,
        status: tables.leads.status,
        caseFile: tables.leads.caseFile,
      })
      .from(tables.leads)
      .where(and(eq(tables.leads.firmId, firm.id), gt(tables.leads.receivedAt, since)));

    if (rows.length === 0) {
      // Nothing happened — don't send an empty-inbox email every week.
      skipped++;
      continue;
    }

    const leadIds = rows.map((r) => r.id);
    const messages: InsightMessage[] = leadIds.length
      ? await db
          .select({ leadId: tables.messages.leadId, approvedAt: tables.messages.approvedAt })
          .from(tables.messages)
          .where(inArray(tables.messages.leadId, leadIds))
      : [];

    const leads: DigestLeadRow[] = rows.map((r) => ({
      id: r.id,
      receivedAt: r.receivedAt,
      status: r.status,
      routing: r.caseFile ? ((r.caseFile as unknown as AnyCaseFile).routing ?? null) : null,
    }));
    const summary = weeklyDigestSummary(leads, messages);

    const recipients = await firmRecipients(firm.id);
    if (recipients.length > 0) {
      const subject = `Last week at ${firm.name}: ${summary.totalLeads} lead${
        summary.totalLeads === 1 ? "" : "s"
      }, ${summary.signNowCount} Sign Now`;
      const body = digestBody(firm.name, summary);
      await Promise.all(recipients.map((to) => sendPlatformEmail(to, subject, body)));
    }

    await db
      .update(tables.firms)
      .set({ lastDigestSentAt: new Date().toISOString() })
      .where(eq(tables.firms.id, firm.id));
    sent++;
  }

  return NextResponse.json({ ok: true, firms: firms.length, sent, skipped });
}
