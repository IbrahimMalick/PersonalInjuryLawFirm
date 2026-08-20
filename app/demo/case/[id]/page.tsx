"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useDesk } from "@/components/DeskData";
import {
  CASE_TYPE_LABEL,
  CHANNEL_LABEL,
  LANGUAGE_LABEL,
  ROUTING_LABEL,
  ROUTING_SENTENCE,
  TREATMENT_LABEL,
} from "@/lib/labels";
import { DEMO_FIRM_NAME, disclaimerFor } from "@/lib/guardrails";

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const desk = useDesk();
  const [sent, setSent] = useState(false);

  const lead = desk.leads.find((l) => l.id === id);
  const cf = lead?.caseFile;

  if (!lead || !cf) {
    return (
      <div className="px-6 pt-10 max-w-xl">
        <p className="text-dim text-lg">
          {lead ? "This inquiry hasn't been processed yet." : "No such case file."}
        </p>
        <Link href="/demo" className="text-manila underline underline-offset-4">
          ← Back to the desk
        </Link>
      </div>
    );
  }

  const sol = cf.statuteOfLimitations;
  const solUrgent = sol.daysRemaining !== null && sol.daysRemaining < 180;
  const conflict = cf.conflictFlags.length > 0;
  const lang = cf.claimant.preferredLanguage ?? "en";

  return (
    <div className="px-6 pt-4 pb-8 max-w-[1360px] mx-auto">
      <div className="flex items-center justify-between pb-3">
        <Link href="/demo" className="field-label text-dim hover:text-inktext">
          ← Live desk
        </Link>
        <span className="font-mono text-sm text-dim">
          {CHANNEL_LABEL[lead.channel]} · received {lead.receivedLabel} · filed{" "}
          {lead.processedAtSim}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-4 items-start">
        {/* ── Left: the partner's read ── */}
        <div className="space-y-3">
          {/* Header card */}
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

          {conflict && (
            <div className="rounded-sm border-2 border-stamp bg-stamp/10 px-5 py-3">
              <div className="field-label text-stamp pb-1">Conflict check — match</div>
              {cf.conflictFlags.map((f) => (
                <div key={f} className="text-stamp font-semibold">
                  {f}
                </div>
              ))}
              <p className="text-sm text-dim mt-1.5">
                The reply below is held. Nothing leaves the building until conflicts counsel
                clears it.
              </p>
            </div>
          )}

          {/* SOL countdown + treatment, side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`rounded-sm border px-5 py-4 ${
                solUrgent ? "border-stamp bg-stamp/10" : "border-ink-line bg-ink-raised"
              }`}
            >
              <div className="field-label text-dim">Statute of limitations</div>
              {sol.daysRemaining !== null ? (
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
                <div className="text-dim text-[15px] mt-2 italic">{sol.basis}</div>
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
              <p className="text-sm text-dim mt-2 leading-snug">
                The strongest value signal in a PI intake — and the field most intake forms
                never ask about.
              </p>
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
                  {cf.otherPartyInfo.insurer ? ` (${cf.otherPartyInfo.insurer})` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Missing info checklist */}
          {cf.missingInfo.length > 0 && (
            <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-4">
              <div className="field-label text-dim pb-2">
                What intake still needs — the morning call script
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

          <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-dim">
              {ROUTING_SENTENCE[cf.routing]}
              {cf.needsHumanReview ? " · Held for human review." : ""}
            </span>
            <span className="font-mono text-sm text-dim">
              confidence {(cf.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* ── Right: the drafted reply on letterhead ── */}
        <div className="rounded-sm bg-paper text-papertext shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          <div className="px-7 pt-6 pb-4 border-b-2 border-papertext/15 text-center">
            <div className="mx-auto w-10 h-10 grid place-items-center border-2 border-papertext rounded-sm font-display font-bold text-lg mb-2">
              R·C
            </div>
            <div className="font-display font-bold text-2xl uppercase tracking-widest">
              Reyes &amp; Cole
            </div>
            <div className="field-label text-paperdim mt-0.5">
              Injury Law · 188 Montague Street, Suite 400 · Brooklyn, NY 11201 · (718) 555-0140
            </div>
          </div>
          <div className="px-7 py-5">
            <div className="field-label text-paperdim pb-3 flex justify-between">
              <span>
                Draft reply — {CHANNEL_LABEL[lead.channel]} ·{" "}
                {LANGUAGE_LABEL[lang] ?? "English"}
              </span>
              <span>{lead.processedAtSim}</span>
            </div>
            <div className="text-[15.5px] leading-relaxed whitespace-pre-line">
              {lead.draftReply}
            </div>
            <div className="mt-5 pt-3 border-t border-papertext/15 text-[13px] leading-snug text-paperdim">
              {disclaimerFor(lang, DEMO_FIRM_NAME)}
            </div>
          </div>
          <div className="px-7 pb-6">
            {conflict ? (
              <div className="w-full text-center rounded-sm border-2 border-stamp text-stamp font-display font-bold uppercase tracking-wider py-2.5">
                Held — conflicts review required
              </div>
            ) : sent ? (
              <div className="w-full text-center rounded-sm border-2 border-carbon/40 bg-carbon/10 text-carbon font-display font-bold uppercase tracking-wider py-2.5">
                ✓ Approved &amp; sent
              </div>
            ) : (
              <button
                className="w-full rounded-sm bg-carbon text-paper font-display font-bold uppercase tracking-wider text-lg py-2.5 hover:bg-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-meter"
                onClick={() => {
                  setSent(true);
                  desk.logLine(
                    `Reply approved by reviewer and sent — ${cf.claimant.name ?? lead.from}`,
                    "ok"
                  );
                }}
              >
                Approve &amp; send
              </button>
            )}
            <p className="text-center text-sm text-paperdim mt-2">
              A person clicks this. The engine never sends on its own.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
