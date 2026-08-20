import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, inArray, notInArray } from "drizzle-orm";
import AppShell from "@/components/product/AppShell";
import { requireUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { getFirm } from "@/lib/firm";
import { isDemo } from "@/lib/mode";
import { fmtDateTime, agoLabel } from "@/lib/format";
import { CASE_TYPE_LABEL, ROUTING_LABEL } from "@/lib/labels";
import type { CaseFile } from "@/lib/schema";

export const dynamic = "force-dynamic";

const CHANNEL_GLYPH: Record<string, string> = {
  voicemail: "VM",
  sms: "SMS",
  whatsapp: "WA",
  webform: "WEB",
  email: "EM",
};

function StatusChip({
  status,
  caseFile,
  replied,
}: {
  status: string;
  caseFile: CaseFile | null;
  replied: boolean;
}) {
  if (status === "needs_attention")
    return <span className="field-label text-stamp">Needs attention</span>;
  if (status === "received" || status === "processing")
    return <span className="field-label text-meter">Reading…</span>;
  if (status === "archived") return <span className="field-label text-dim">Archived</span>;
  if (caseFile?.conflictFlags?.length)
    return <span className="field-label text-stamp">CONFLICT — HELD</span>;
  if (replied) return <span className="field-label text-ok">Reply sent ✓</span>;
  if (caseFile)
    return (
      <span
        className={`field-label ${caseFile.routing === "decline" ? "text-stamp" : "text-manila"}`}
      >
        {ROUTING_LABEL[caseFile.routing]} · awaiting review
      </span>
    );
  return <span className="field-label text-dim">Waiting</span>;
}

export default async function Inbox() {
  if (isDemo()) redirect("/demo");
  const user = await requireUser();
  const firm = await getFirm();
  const db = await getDb();

  const leads = await db
    .select()
    .from(tables.leads)
    .where(notInArray(tables.leads.status, ["archived"]))
    .orderBy(desc(tables.leads.receivedAt))
    .limit(200);

  const repliedRows = leads.length
    ? await db
        .select({ leadId: tables.messages.leadId })
        .from(tables.messages)
        .where(
          inArray(
            tables.messages.leadId,
            leads.map((l) => l.id)
          )
        )
    : [];
  const replied = new Set(repliedRows.map((r) => r.leadId));

  const counts = {
    waiting: leads.filter(
      (l) => l.status === "triaged" && !replied.has(l.id)
    ).length,
    attention: leads.filter((l) => l.status === "needs_attention").length,
    reading: leads.filter((l) => l.status === "received" || l.status === "processing").length,
  };

  return (
    <AppShell user={user}>
      <div className="px-6 pt-4 max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-5 font-mono text-sm">
            <span className="text-manila">{counts.waiting} awaiting review</span>
            {counts.attention > 0 && (
              <span className="text-stamp">{counts.attention} need attention</span>
            )}
            {counts.reading > 0 && <span className="text-meter">{counts.reading} reading</span>}
          </div>
          <Link href="/archive" className="field-label text-dim hover:text-inktext">
            Archive ▸
          </Link>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-sm border border-ink-line bg-ink-raised px-6 py-14 text-center">
            <div className="font-display uppercase tracking-widest text-dim text-xl">
              The desk is quiet
            </div>
            <p className="text-dim mt-2 text-[15px] max-w-md mx-auto">
              New inquiries land here the moment they arrive — from the intake form, the
              firm&apos;s phone line, or email. Wire channels up under Settings.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leads.map((lead) => {
              const cf = (lead.caseFile as unknown as CaseFile | null) ?? null;
              const needsEyes =
                lead.status === "needs_attention" ||
                (lead.status === "triaged" && !replied.has(lead.id));
              return (
                <Link
                  key={lead.id}
                  href={`/lead/${lead.id}`}
                  className={`grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4 rounded-sm border px-4 py-3 bg-ink-raised transition-colors hover:border-manila ${
                    needsEyes ? "border-ink-line" : "border-ink-line/50 opacity-80"
                  }`}
                >
                  <span className="font-mono text-xs text-dim border border-ink-line rounded-sm text-center py-1">
                    {CHANNEL_GLYPH[lead.channel] ?? lead.channel}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-3">
                      <span className="font-display font-semibold text-lg text-paper uppercase tracking-wide truncate">
                        {cf?.claimant.name ?? lead.displayName ?? lead.fromAddress}
                      </span>
                      {cf && (
                        <span className="font-mono text-sm text-dim shrink-0">
                          {CASE_TYPE_LABEL[cf.caseType]}
                          {" · "}priority {cf.priorityScore}
                        </span>
                      )}
                    </span>
                    <span className="block text-[14px] text-dim truncate mt-0.5">
                      {lead.raw.replace(/\s+/g, " ").slice(0, 140)}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <StatusChip
                      status={lead.status}
                      caseFile={cf}
                      replied={replied.has(lead.id)}
                    />
                    <span className="block font-mono text-xs text-dim mt-1">
                      {fmtDateTime(lead.receivedAt, firm.timezone)} · {agoLabel(lead.receivedAt)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
