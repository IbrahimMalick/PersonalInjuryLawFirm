"use client";

import type { Lead } from "@/lib/schema";
import { ROUTING_LABEL } from "@/lib/labels";
import { useDesk } from "./DeskData";

// Channel glyphs — small, single-color, no dependency.
function Glyph({ channel }: { channel: Lead["channel"] }) {
  const cls = "w-4 h-4 shrink-0";
  switch (channel) {
    case "voicemail":
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="currentColor" aria-hidden>
          <circle cx="4" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="4" y="9.7" width="8" height="1.6" />
        </svg>
      );
    case "sms":
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="currentColor" aria-hidden>
          <path d="M2 2h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6l-3.5 3v-3H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
        </svg>
      );
    case "webform":
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <rect x="1.5" y="2" width="13" height="12" rx="1" />
          <line x1="4" y1="5.5" x2="12" y2="5.5" />
          <line x1="4" y1="8.5" x2="12" y2="8.5" />
          <line x1="4" y1="11.5" x2="9" y2="11.5" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="currentColor" aria-hidden>
          <path d="M8 1.5A6.5 6.5 0 0 0 2.4 11.3L1.5 14.5l3.3-.9A6.5 6.5 0 1 0 8 1.5zm3.2 9.1c-.2.5-.9.9-1.4 1-.4.1-.9.1-2.6-.6-2.1-.9-3.4-3-3.5-3.2-.1-.1-.8-1.1-.8-2.1s.5-1.5.7-1.7c.2-.2.4-.2.6-.2h.4c.1 0 .3 0 .4.3l.6 1.5c.1.1.1.3 0 .4l-.3.4c-.1.2-.2.3-.1.5.1.2.6 1 1.3 1.6.9.8 1.6 1 1.8 1.1.2.1.3.1.5-.1l.5-.6c.1-.2.3-.2.5-.1l1.4.7c.2.1.3.1.4.2 0 .2 0 .5-.2.9z" />
        </svg>
      );
  }
}

function Waveform() {
  // Static waveform for the voicemail card — texture, not motion.
  const bars = [3, 7, 5, 10, 12, 8, 11, 6, 9, 12, 7, 4, 8, 10, 5, 7, 3, 6, 9, 5, 8, 4];
  return (
    <svg viewBox={`0 0 ${bars.length * 5} 16`} className="h-6 w-full text-manila-deep" aria-hidden>
      {bars.map((h, i) => (
        <rect key={i} x={i * 5} y={8 - h / 2} width="2.6" height={h} rx="1" fill="currentColor" />
      ))}
    </svg>
  );
}

function StatusChip({ lead, isProcessing }: { lead: Lead; isProcessing: boolean }) {
  if (isProcessing) {
    return <span className="field-label text-meter">Reading…</span>;
  }
  if (lead.status === "done" && lead.caseFile) {
    const routing = lead.caseFile.routing;
    const color =
      routing === "decline"
        ? "text-stamp"
        : lead.caseFile.conflictFlags.length > 0
          ? "text-stamp"
          : "text-ok";
    return (
      <span className={`field-label ${color}`}>
        {lead.caseFile.conflictFlags.length > 0 ? "CONFLICT — HELD" : ROUTING_LABEL[routing]}
      </span>
    );
  }
  return <span className="field-label text-dim">Needs a callback</span>;
}

export default function LeadCard({ lead }: { lead: Lead }) {
  const desk = useDesk();
  const isProcessing = desk.processing.has(lead.id);
  const selected = desk.selectedId === lead.id;

  const frame = `w-full text-left rounded-sm border transition-colors cursor-pointer ${
    selected ? "border-manila" : "border-ink-line hover:border-dim"
  }`;

  const header = (
    <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
      <span className="flex items-center gap-2 text-dim">
        <Glyph channel={lead.channel} />
        <span className="font-mono text-sm text-inktext">
          {lead.displayName ? `${lead.displayName} · ` : ""}
          {lead.from}
        </span>
      </span>
      <span className="font-mono text-sm text-dim tabular-nums">{lead.receivedLabel}</span>
    </div>
  );

  const body = (() => {
    switch (lead.channel) {
      case "voicemail":
        return (
          <div className="px-3 pb-3 pt-2">
            <div className="flex items-center gap-2 rounded-sm bg-ink px-2.5 py-2 border border-ink-line">
              <span className="text-manila" aria-hidden>
                ▶
              </span>
              <Waveform />
              <span className="font-mono text-xs text-dim">
                {Math.floor((lead.meta?.durationSec ?? 0) / 60)}:
                {String((lead.meta?.durationSec ?? 0) % 60).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-2 text-[15px] text-inktext/90 italic line-clamp-4">
              “{lead.raw}”
            </p>
          </div>
        );
      case "sms":
        return (
          <div className="px-3 pb-3 pt-2">
            <div className="max-w-[92%] rounded-xl rounded-bl-sm bg-carbon px-3.5 py-2.5 text-[15px]">
              {lead.raw}
            </div>
          </div>
        );
      case "whatsapp":
        return (
          <div className="px-3 pb-3 pt-2">
            <div className="max-w-[92%] rounded-xl rounded-bl-sm bg-carbon px-3.5 py-2.5 text-[15px]">
              <p className="line-clamp-5">{lead.raw}</p>
              {lead.meta?.photos && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lead.meta.photos.map((p) => (
                    <span
                      key={p}
                      className="font-mono text-xs text-manila border border-manila/40 rounded-sm px-1.5 py-0.5"
                    >
                      📷 {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case "webform":
        return (
          <div className="px-3 pb-3 pt-2 space-y-1.5">
            {Object.entries(lead.meta?.formFields ?? {}).map(([k, v]) => (
              <div key={k} className="border border-ink-line rounded-sm px-2.5 py-1.5 bg-ink">
                <div className="field-label text-dim">{k}</div>
                <div className={`text-[15px] ${v ? "text-inktext" : "text-dim italic"}`}>
                  {v || "(blank)"}
                </div>
              </div>
            ))}
          </div>
        );
    }
  })();

  return (
    <div className={`${frame} bg-ink-raised`}>
      <button
        className="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-meter"
        onClick={() => desk.select(lead.id)}
        aria-label={`Select message from ${lead.from}`}
      >
        {header}
        {body}
      </button>
      <div className="flex items-center justify-between px-3 pb-2.5 -mt-1">
        <StatusChip lead={lead} isProcessing={isProcessing} />
        {lead.status === "new" && !isProcessing && (
          <button
            className="field-label text-manila hover:text-meter focus-visible:outline focus-visible:outline-2 focus-visible:outline-meter"
            onClick={() => desk.runOne(lead.id)}
            disabled={desk.running}
          >
            Process ▸
          </button>
        )}
        {lead.status === "done" && (
          <a
            href={`/demo/case/${lead.id}`}
            className="field-label text-manila hover:text-meter focus-visible:outline focus-visible:outline-2 focus-visible:outline-meter"
          >
            Open case file ▸
          </a>
        )}
      </div>
    </div>
  );
}
