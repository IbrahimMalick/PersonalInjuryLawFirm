"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The reviewer's half of the case screen: the draft on firm letterhead,
// editable in place, with Approve & Send. Every path through this panel is a
// human decision — the buttons are the product's whole promise.

interface Props {
  leadId: string;
  initialDraft: string;
  disclaimer: string;
  firm: { name: string; practiceLine: string; addressLine: string; phone: string };
  headerNote: string; // "Draft reply — Voicemail · English"
  destination: string | null; // "Text message to (347) 555-0119" or null
  conflict: boolean;
  isAdmin: boolean;
  sent: { status: string; at: string | null; to: string } | null;
  canReprocess: boolean;
}

export default function ReviewPanel(props: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(props.initialDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body?: unknown): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const edited = draft.trim() !== props.initialDraft.trim();

  return (
    <div className="rounded-sm bg-paper text-papertext shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
      <div className="px-7 pt-6 pb-4 border-b-2 border-papertext/15 text-center">
        <div className="mx-auto w-10 h-10 grid place-items-center border-2 border-papertext rounded-sm font-display font-bold text-lg mb-2">
          {props.firm.name
            .split(/\s+/)
            .map((w) => w[0])
            .slice(0, 2)
            .join("·")}
        </div>
        <div className="font-display font-bold text-2xl uppercase tracking-widest">
          {props.firm.name}
        </div>
        <div className="field-label text-paperdim mt-0.5">
          {props.firm.practiceLine}
          {props.firm.addressLine ? ` · ${props.firm.addressLine}` : ""}
          {props.firm.phone ? ` · ${props.firm.phone}` : ""}
        </div>
      </div>

      <div className="px-7 py-5">
        <div className="field-label text-paperdim pb-3 flex justify-between gap-3">
          <span>{props.headerNote}</span>
          {props.destination && <span className="text-right">{props.destination}</span>}
        </div>

        {props.sent ? (
          <div className="text-[15.5px] leading-relaxed whitespace-pre-line">{props.initialDraft}</div>
        ) : (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(8, draft.split("\n").length + 2)}
            className="w-full bg-transparent text-[15.5px] leading-relaxed resize-y focus:outline focus:outline-2 focus:outline-carbon/40 rounded-sm p-1 -m-1"
            aria-label="Draft reply — edit before approving"
          />
        )}

        <div className="mt-5 pt-3 border-t border-papertext/15 text-[13px] leading-snug text-paperdim">
          {props.disclaimer}
        </div>
        {!props.sent && edited && (
          <p className="field-label text-carbon mt-2">Edited from the AI draft — the edit is logged.</p>
        )}
      </div>

      <div className="px-7 pb-6 space-y-2">
        {error && (
          <p className="text-stamp text-sm border border-stamp/50 rounded-sm px-3 py-2">{error}</p>
        )}

        {props.sent ? (
          <div className="w-full text-center rounded-sm border-2 border-carbon/40 bg-carbon/10 text-carbon font-display font-bold uppercase tracking-wider py-2.5">
            {props.sent.status === "queued" && "✓ Approved — sending…"}
            {props.sent.status === "sent" && `✓ Sent to ${props.sent.to}`}
            {props.sent.status === "simulated" &&
              `✓ Approved — SIMULATED (channel not configured)`}
            {props.sent.status === "failed" && (
              <span className="text-stamp">Send failed — see audit trail</span>
            )}
          </div>
        ) : props.conflict && !props.isAdmin ? (
          <div className="w-full text-center rounded-sm border-2 border-stamp text-stamp font-display font-bold uppercase tracking-wider py-2.5">
            Held — an administrator must release this reply
          </div>
        ) : props.destination ? (
          <button
            onClick={() => post(`/api/leads/${props.leadId}/approve`, { body: draft })}
            disabled={busy || !draft.trim()}
            className="w-full rounded-sm bg-carbon text-paper font-display font-bold uppercase tracking-wider text-lg py-2.5 hover:bg-ink transition-colors disabled:opacity-50"
          >
            {props.conflict ? "Release conflict hold & send" : "Approve & send"}
          </button>
        ) : (
          <div className="w-full text-center rounded-sm border-2 border-papertext/30 text-paperdim font-display font-bold uppercase tracking-wider py-2.5">
            No reachable address — call back by hand
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-paperdim">
            A person clicks this. The engine never sends on its own.
          </p>
          <span className="flex gap-3">
            {props.canReprocess && (
              <button
                onClick={() => post(`/api/leads/${props.leadId}/reprocess`)}
                disabled={busy}
                className="field-label text-carbon underline underline-offset-4 hover:text-papertext"
              >
                Re-run triage
              </button>
            )}
            {!props.sent && (
              <button
                onClick={() => post(`/api/leads/${props.leadId}/archive`)}
                disabled={busy}
                className="field-label text-paperdim underline underline-offset-4 hover:text-stamp"
              >
                Archive without replying
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
