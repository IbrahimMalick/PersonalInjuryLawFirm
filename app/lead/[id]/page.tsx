import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/product/AppShell";
import ReviewPanel from "@/components/product/ReviewPanel";
import { requireFirmUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { disclaimerFor } from "@/lib/guardrails";
import {
  CASE_TYPE_LABEL,
  CHANNEL_LABEL,
  LANGUAGE_LABEL,
  ROUTING_LABEL,
  ROUTING_SENTENCE,
  TREATMENT_LABEL,
} from "@/lib/labels";
import { isDemo } from "@/lib/mode";
import { resolveReplyDestination } from "@/lib/reply";
import type { CaseFile } from "@/lib/schema";

export const dynamic = "force-dynamic";

const EMAIL_CHANNEL_LABELS: Record<string, string> = { ...CHANNEL_LABEL, email: "Email" };

export default async function LeadReview({ params }: { params: Promise<{ id: string }> }) {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser();
  const { id } = await params;
  const db = await getDb();

  const lead = (await db.select().from(tables.leads).where(eq(tables.leads.id, id)).limit(1))[0];
  if (!lead || lead.firmId !== firm.id) notFound();

  const [message] = await db
    .select()
    .from(tables.messages)
    .where(eq(tables.messages.leadId, id))
    .orderBy(desc(tables.messages.id))
    .limit(1);

  const trail = await db
    .select()
    .from(tables.auditEvents)
    .where(eq(tables.auditEvents.leadId, id))
    .orderBy(asc(tables.auditEvents.id));

  const cf = (lead.caseFile as unknown as CaseFile | null) ?? null;
  const sol = cf?.statuteOfLimitations;
  const solUrgent = sol?.daysRemaining != null && sol.daysRemaining < 180;
  const conflict = (cf?.conflictFlags.length ?? 0) > 0;
  const lang = cf?.claimant.preferredLanguage ?? "en";
  const destination = cf ? resolveReplyDestination(lead, cf) : null;
  const solAcknowledged = Boolean(firm.solAcknowledgedAt);

  return (
    <AppShell user={user} firm={firm}>
      <div className="px-6 pt-4 pb-8 max-w-[1360px] mx-auto">
        <div className="flex items-center justify-between pb-3">
          <Link href="/" className="field-label text-dim hover:text-inktext">
            ← Inbox
          </Link>
          <span className="font-mono text-sm text-dim">
            {EMAIL_CHANNEL_LABELS[lead.channel]} · received{" "}
            {fmtDateTime(lead.receivedAt, firm.timezone)}
            {lead.processedAt ? ` · triaged ${fmtDateTime(lead.processedAt, firm.timezone)}` : ""}
          </span>
        </div>

        <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-4 items-start">
          {/* ── Left: the case ── */}
          <div className="space-y-3">
            {lead.status === "needs_attention" && (
              <div className="rounded-sm border-2 border-stamp bg-stamp/10 px-5 py-3">
                <div className="field-label text-stamp pb-1">Automatic triage failed</div>
                <p className="text-sm text-dim">
                  {lead.processingError ?? "Extraction did not complete."} The raw message is
                  below — handle it by hand, or re-run triage from the panel on the right.
                </p>
              </div>
            )}

            {(lead.status === "received" || lead.status === "processing") && (
              <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-3">
                <span className="field-label text-meter">
                  Reading the message — refresh in a few seconds
                </span>
              </div>
            )}

            {cf && (
              <div className="rounded-sm bg-manila text-papertext px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="font-display font-bold text-3xl uppercase tracking-wide leading-none">
                      {cf.claimant.name ?? "Name unknown"}
                    </h1>
                    <div className="font-mono text-sm mt-1.5 text-paperdim">
                      {CASE_TYPE_LABEL[cf.caseType]}
                      {cf.incidentLocation ? ` · ${cf.incidentLocation}` : ""}
                    </div>
                  </div>
                  <span
                    className={`stamp-box text-xl shrink-0 ${
                      cf.routing === "decline" || conflict ? "text-stamp" : "text-carbon"
                    }`}
                  >
                    {conflict ? "CONFLICT — HOLD" : ROUTING_LABEL[cf.routing]}
                  </span>
                </div>
                <div className="flex items-center gap-5 mt-4 border-t-2 border-papertext/20 pt-3">
                  <div>
                    <div className="field-label text-paperdim">Priority</div>
                    <div className="font-mono font-semibold text-5xl leading-none tabular-nums">
                      {cf.priorityScore}
                    </div>
                  </div>
                  <p className="text-[15px] leading-snug flex-1">{cf.scoreRationale}</p>
                </div>
              </div>
            )}

            {conflict && cf && (
              <div className="rounded-sm border-2 border-stamp bg-stamp/10 px-5 py-3">
                <div className="field-label text-stamp pb-1">Conflict check — match</div>
                {cf.conflictFlags.map((f) => (
                  <div key={f} className="text-stamp font-semibold">
                    {f}
                  </div>
                ))}
                <p className="text-sm text-dim mt-1.5">
                  Matched against the firm&apos;s conflict list. Only an administrator can
                  release the reply.
                </p>
              </div>
            )}

            {cf && (
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`rounded-sm border px-5 py-4 ${
                    solUrgent && solAcknowledged
                      ? "border-stamp bg-stamp/10"
                      : "border-ink-line bg-ink-raised"
                  }`}
                >
                  <div className="field-label text-dim">Statute of limitations</div>
                  {!solAcknowledged ? (
                    <p className="text-dim text-[15px] mt-2 italic">
                      Hidden until an attorney reviews and acknowledges the deadline table in
                      Settings.
                    </p>
                  ) : sol?.daysRemaining != null ? (
                    <>
                      <div
                        className={`font-mono font-semibold text-5xl tabular-nums leading-none mt-2 ${
                          solUrgent ? "text-stamp" : "text-inktext"
                        }`}
                      >
                        {sol.daysRemaining.toLocaleString()}
                        <span className="text-lg text-dim ml-2">days left</span>
                      </div>
                      <div className="font-mono text-sm text-dim mt-2">
                        deadline {sol.deadlineISO}
                      </div>
                      <div className="text-sm text-dim mt-1">{sol.basis}</div>
                    </>
                  ) : (
                    <div className="text-dim text-[15px] mt-2 italic">{sol?.basis}</div>
                  )}
                  <div className="field-label text-manila mt-3">
                    Computed by table + date math — never by the model
                  </div>
                </div>

                <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-4">
                  <div className="field-label text-dim">Treatment status</div>
                  <div className="font-display font-bold uppercase tracking-wide text-3xl mt-2 text-inktext">
                    {TREATMENT_LABEL[cf.treatmentStatus]}
                  </div>
                  <div className="mt-3 space-y-1 font-mono text-sm">
                    <div>
                      <span className="text-dim">Incident date · </span>
                      {cf.incidentDate ?? "not confirmed"}
                    </div>
                    <div>
                      <span className="text-dim">Liability · </span>
                      <span className="capitalize">{cf.liabilityClarity}</span>
                    </div>
                    <div>
                      <span className="text-dim">Already has a lawyer · </span>
                      {cf.priorRepresentation === "unknown"
                        ? "unknown"
                        : cf.priorRepresentation
                          ? "yes"
                          : "no"}
                    </div>
                    <div>
                      <span className="text-dim">Other party · </span>
                      {cf.otherPartyInfo.name ?? "unknown"}
                      {cf.otherPartyInfo.insurer ? ` · ${cf.otherPartyInfo.insurer}` : ""}
                    </div>
                    <div>
                      <span className="text-dim">Confidence · </span>
                      {((cf.confidence ?? 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {cf && cf.missingInfo.length > 0 && (
              <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-4">
                <div className="field-label text-dim pb-2">
                  What intake still needs — the call script
                </div>
                <ul className="space-y-1.5">
                  {cf.missingInfo.map((q) => (
                    <li key={q} className="flex gap-2.5 text-[15px]">
                      <span className="text-manila">☐</span> {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* The original message, always */}
            <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-4">
              <div className="field-label text-dim pb-2">
                As it arrived — {EMAIL_CHANNEL_LABELS[lead.channel]} from{" "}
                {lead.displayName ? `${lead.displayName} · ` : ""}
                {lead.fromAddress}
              </div>
              <p className="text-[15px] whitespace-pre-line text-inktext/90">{lead.raw}</p>
              {Boolean((lead.meta as Record<string, unknown>)?.recordingUrl) && (
                <p className="font-mono text-sm text-manila mt-2">
                  Recording: {String((lead.meta as Record<string, unknown>).recordingUrl)}
                </p>
              )}
            </div>

            {/* Audit trail */}
            <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-4">
              <div className="field-label text-dim pb-2">Audit trail</div>
              <div className="font-mono text-sm leading-6">
                {trail.map((e) => (
                  <div key={e.id} className="flex gap-3">
                    <span className="text-meter/80 tabular-nums shrink-0 w-40">
                      {fmtDateTime(e.createdAt, firm.timezone)}
                    </span>
                    <span
                      className={
                        e.type.includes("conflict") || e.type.includes("failed")
                          ? "text-stamp"
                          : e.type.includes("approved") || e.type.includes("sent")
                            ? "text-ok"
                            : "text-dim"
                      }
                    >
                      {e.type}
                      {e.userId ? ` · user #${e.userId}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: the reply ── */}
          <div>
            {cf ? (
              <ReviewPanel
                leadId={lead.id}
                initialDraft={message ? message.body.split("\n\n").slice(0, -1).join("\n\n") : (lead.draftReply ?? "")}
                disclaimer={disclaimerFor(lang, firm.name)}
                firm={{
                  name: firm.name,
                  practiceLine: firm.practiceLine,
                  addressLine: firm.addressLine,
                  phone: firm.phone,
                }}
                headerNote={`Draft reply — ${EMAIL_CHANNEL_LABELS[lead.channel]} · ${LANGUAGE_LABEL[lang] ?? "English"}`}
                destination={destination?.describe ?? null}
                conflict={conflict}
                isAdmin={user.role === "admin"}
                sent={
                  message
                    ? { status: message.status, at: message.sentAt, to: message.toAddress }
                    : null
                }
                canReprocess={lead.status === "needs_attention" || lead.status === "triaged"}
              />
            ) : (
              <ReviewPanel
                leadId={lead.id}
                initialDraft=""
                disclaimer={disclaimerFor("en", firm.name)}
                firm={{
                  name: firm.name,
                  practiceLine: firm.practiceLine,
                  addressLine: firm.addressLine,
                  phone: firm.phone,
                }}
                headerNote="No draft yet"
                destination={null}
                conflict={false}
                isAdmin={user.role === "admin"}
                sent={null}
                canReprocess={lead.status === "needs_attention"}
              />
            )}
            {cf && (
              <p className="text-sm text-dim mt-3 px-1">
                {ROUTING_SENTENCE[cf.routing]}
                {cf.needsHumanReview ? " · Flagged for human review." : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
