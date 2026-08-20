"use client";

import type { CaseFile, Lead } from "@/lib/schema";
import {
  CASE_TYPE_LABEL,
  ROUTING_LABEL,
  ROUTING_SENTENCE,
  TREATMENT_LABEL,
} from "@/lib/labels";
import { useDesk } from "./DeskData";

// The right side of the Live Desk: the case file materializing as manila
// paperwork. Rows reveal top-to-bottom (the one orchestrated animation);
// the routing stamp lands last.

function Row({
  label,
  children,
  delay,
  animate,
}: {
  label: string;
  children: React.ReactNode;
  delay: number;
  animate: boolean;
}) {
  return (
    <div
      className={animate ? "reveal-row" : undefined}
      style={animate ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      <div className="field-label text-paperdim">{label}</div>
      <div className="text-papertext text-[15px] leading-snug">{children}</div>
    </div>
  );
}

function val(v: string | null, fallback = "— not provided —") {
  return v ?? <span className="text-paperdim italic">{fallback}</span>;
}

export default function CaseFilePanel({ lead }: { lead: Lead | null }) {
  const desk = useDesk();

  if (!lead) {
    return (
      <aside className="h-full grid place-items-center rounded-sm border border-ink-line bg-ink-raised">
        <div className="text-center px-8">
          <div className="font-display uppercase tracking-widest text-dim text-xl">
            No file open
          </div>
          <p className="text-dim mt-2 text-[15px]">
            Select a message on the left, or press <span className="font-mono">N</span> to
            process the next one.
          </p>
        </div>
      </aside>
    );
  }

  const isProcessing = desk.processing.has(lead.id);
  if (isProcessing || !lead.caseFile) {
    return (
      <aside className="h-full grid place-items-center rounded-sm border border-ink-line bg-ink-raised">
        <div className="text-center px-8">
          {isProcessing ? (
            <>
              <div className="font-display uppercase tracking-widest text-meter text-2xl">
                Reading the message
              </div>
              <p className="text-dim mt-2 text-[15px] font-mono">
                extracting facts · checking conflicts · drafting a reply
              </p>
            </>
          ) : (
            <>
              <div className="font-display uppercase tracking-widest text-dim text-xl">
                Not processed yet
              </div>
              <p className="text-dim mt-2 text-[15px]">
                This inquiry is waiting.{" "}
                <button
                  className="text-manila underline underline-offset-4 hover:text-meter"
                  onClick={() => desk.runOne(lead.id)}
                  disabled={desk.running}
                >
                  Process it now
                </button>
              </p>
            </>
          )}
        </div>
      </aside>
    );
  }

  const cf: CaseFile = lead.caseFile;
  const revealTs = desk.revealAt[lead.id];
  const animate = Boolean(revealTs && Date.now() - revealTs < 12_000);
  let i = 0;
  const d = () => i++ * 150;

  const sol = cf.statuteOfLimitations;
  const solUrgent = sol.daysRemaining !== null && sol.daysRemaining < 180;
  const conflict = cf.conflictFlags.length > 0;

  return (
    <aside className="h-full overflow-y-auto rounded-sm bg-manila text-papertext shadow-[inset_0_0_60px_rgba(120,90,30,0.15)]">
      {/* Folder tab */}
      <div className="flex items-end justify-between px-4 pt-2">
        <span className="folder-tab bg-manila-deep px-4 py-1 font-display font-bold uppercase tracking-wider text-sm">
          Case file
        </span>
        <span className="font-mono text-xs text-paperdim pb-1">
          filed {lead.processedAtSim ?? "—"} · Nightshift intake
        </span>
      </div>

      <div className="px-5 py-4 space-y-3.5">
        <div className={animate ? "reveal-row" : undefined} style={animate ? ({ "--reveal-delay": `${d()}ms` } as React.CSSProperties) : undefined}>
          <div className="flex items-center justify-between gap-3 border-b-2 border-papertext/20 pb-2">
            <span>
              <span className="block font-display font-bold text-2xl uppercase tracking-wide leading-none">
                {cf.claimant.name ?? "Name unknown"}
              </span>
              <span className="font-mono text-sm text-paperdim">{CASE_TYPE_LABEL[cf.caseType]}</span>
            </span>
            {/* The verdict lands last in time, but lives above the fold. */}
            <span
              className={`stamp-box text-xl shrink-0 ${animate ? "reveal-stamp" : ""} ${
                cf.routing === "decline" || conflict ? "text-stamp" : "text-carbon"
              }`}
              style={animate ? ({ "--reveal-delay": `${13 * 150 + 250}ms` } as React.CSSProperties) : undefined}
            >
              {conflict ? "CONFLICT — HOLD" : ROUTING_LABEL[cf.routing]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Row label="Phone" delay={d()} animate={animate}>
            <span className="font-mono">{val(cf.claimant.phone)}</span>
          </Row>
          <Row label="Email / language" delay={d()} animate={animate}>
            {cf.claimant.email ? (
              <>
                <span className="font-mono">{cf.claimant.email}</span>
                {" · "}
              </>
            ) : null}
            {cf.claimant.preferredLanguage === "es" ? "Spanish" : "English"}
          </Row>
          <Row label="Incident date" delay={d()} animate={animate}>
            <span className="font-mono">{val(cf.incidentDate, "not confirmed")}</span>
          </Row>
          <Row label="Location" delay={d()} animate={animate}>
            {val(cf.incidentLocation)}
          </Row>
        </div>

        <Row label="Injury" delay={d()} animate={animate}>
          {val(cf.injuryDescription, "not described")}
        </Row>

        {/* Treatment status gets the loud box — biggest value signal in PI */}
        <div
          className={animate ? "reveal-row" : undefined}
          style={animate ? ({ "--reveal-delay": `${d()}ms` } as React.CSSProperties) : undefined}
        >
          <div className="border-2 border-papertext/60 rounded-sm px-3 py-2 flex items-center justify-between bg-paper">
            <span className="field-label text-paperdim">Treatment</span>
            <span className="font-display font-bold uppercase tracking-wide text-lg">
              {TREATMENT_LABEL[cf.treatmentStatus]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Row label="Liability" delay={d()} animate={animate}>
            <span className="capitalize font-semibold">{cf.liabilityClarity}</span> —{" "}
            {cf.liabilityNote}
          </Row>
          <Row label="Other party" delay={d()} animate={animate}>
            {val(cf.otherPartyInfo.name, "unknown")}
            {cf.otherPartyInfo.insurer ? ` · ${cf.otherPartyInfo.insurer}` : ""}
            {cf.otherPartyInfo.policyLimits ? ` · limits ${cf.otherPartyInfo.policyLimits}` : ""}
          </Row>
          <Row label="Already has a lawyer?" delay={d()} animate={animate}>
            {cf.priorRepresentation === "unknown"
              ? "Unknown"
              : cf.priorRepresentation
                ? "Yes — different routing"
                : "No"}
          </Row>
          <Row label="Filing deadline (computed, not AI)" delay={d()} animate={animate}>
            {sol.deadlineISO ? (
              <span className={solUrgent ? "text-stamp font-semibold" : undefined}>
                <span className="font-mono">{sol.deadlineISO}</span> ·{" "}
                <span className="font-mono">{sol.daysRemaining}</span> days left
              </span>
            ) : (
              <span className="italic text-paperdim">{sol.basis}</span>
            )}
          </Row>
        </div>

        {conflict && (
          <div
            className={animate ? "reveal-row" : undefined}
            style={animate ? ({ "--reveal-delay": `${d()}ms` } as React.CSSProperties) : undefined}
          >
            <div className="border-2 border-stamp rounded-sm px-3 py-2 bg-stamp/10">
              <div className="field-label text-stamp">Conflict check — match</div>
              {cf.conflictFlags.map((f) => (
                <div key={f} className="text-stamp font-semibold text-[15px]">
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}

        {cf.missingInfo.length > 0 && (
          <Row label="Intake still needs" delay={d()} animate={animate}>
            <ul className="list-none space-y-0.5">
              {cf.missingInfo.slice(0, 4).map((q) => (
                <li key={q} className="flex gap-2">
                  <span className="text-paperdim">☐</span> {q}
                </li>
              ))}
              {cf.missingInfo.length > 4 && (
                <li className="text-paperdim italic">
                  +{cf.missingInfo.length - 4} more on the case file
                </li>
              )}
            </ul>
          </Row>
        )}

        <div
          className={animate ? "reveal-row" : undefined}
          style={animate ? ({ "--reveal-delay": `${d()}ms` } as React.CSSProperties) : undefined}
        >
          <div className="flex items-center gap-4 border-t-2 border-papertext/20 pt-3">
            <div>
              <div className="field-label text-paperdim">Priority</div>
              <div className="font-mono font-semibold text-4xl leading-none tabular-nums">
                {cf.priorityScore}
              </div>
            </div>
            <p className="text-[15px] leading-snug flex-1">{cf.scoreRationale}</p>
          </div>
        </div>

        <div
          className={animate ? "reveal-row" : undefined}
          style={animate ? ({ "--reveal-delay": `${d()}ms` } as React.CSSProperties) : undefined}
        >
          <div className="flex items-center justify-between gap-3 pb-2 text-sm text-paperdim">
            <span className="leading-snug">
              {conflict
                ? "Nothing goes out. A person decides who calls whom."
                : ROUTING_SENTENCE[cf.routing]}
              {cf.needsHumanReview && !conflict ? " · Human review required." : ""}
            </span>
            <a
              href={`/demo/case/${lead.id}`}
              className="field-label text-carbon underline underline-offset-4 shrink-0 hover:text-papertext"
            >
              Open case file ▸
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
