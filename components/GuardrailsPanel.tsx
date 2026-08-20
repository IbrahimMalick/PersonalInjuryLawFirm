"use client";

import { conductRules, disclaimerFor, REVIEW_RULES } from "@/lib/guardrails";

// The honesty panel. Everything shown here is imported from lib/guardrails.ts —
// the same constants the extraction call and the reply pipeline actually use.
// Nothing on this page is a paraphrase.

const NEVER = [
  {
    title: "No legal advice",
    body: "The engine routes inquiries. It never applies law to a caller's facts, never says 'you have a case,' never advises anyone what to do.",
  },
  {
    title: "No case values",
    body: "It will not estimate, imply, or speculate about what any claim is worth — not to the caller, not in the case file.",
  },
  {
    title: "No attorney-client relationship",
    body: "Every reply carries the firm's disclaimer, appended by application code. The model cannot omit it because the model never controls it.",
  },
  {
    title: "Nothing signed, nothing sent",
    body: "Every draft is queued for a person. Sign-now cases are force-flagged for review. The Send button is a human's finger, not a webhook.",
  },
];

export default function GuardrailsPanel({ firmName }: { firmName: string }) {
  return (
    <div className="px-6 pt-6 pb-12 max-w-[1280px] mx-auto">
      <header className="max-w-2xl">
        <h1 className="font-display font-bold uppercase tracking-wide text-3xl text-paper">
          What this system is built to never do
        </h1>
        <p className="text-dim text-[15px] mt-2">
          An AI that improvises around a law firm is a liability engine. These aren&apos;t
          settings — they&apos;re the architecture, and this page shows the real text.
        </p>
      </header>

      <div className="grid grid-cols-4 gap-3 mt-6">
        {NEVER.map((n, i) => (
          <div key={n.title} className="rounded-sm border-2 border-stamp/70 bg-ink-raised px-4 py-3.5">
            <div className="font-mono text-stamp text-sm pb-1">{String(i + 1).padStart(2, "0")}</div>
            <div className="font-display font-bold uppercase tracking-wide text-lg text-paper leading-tight">
              {n.title}
            </div>
            <p className="text-sm text-dim mt-1.5 leading-snug">{n.body}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-8 items-start">
        <section>
          <div className="field-label text-dim pb-2">
            The actual system prompt — conduct section, verbatim from lib/guardrails.ts
          </div>
          <pre className="rounded-sm border border-ink-line bg-ink-raised p-4 text-[13.5px] leading-relaxed font-mono whitespace-pre-wrap text-inktext/90">
            {conductRules(firmName)}
          </pre>
        </section>

        <div className="space-y-4">
          <section>
            <div className="field-label text-dim pb-2">
              The disclaimer appended to every auto-reply — by code, not by the model
            </div>
            <div className="rounded-sm bg-paper text-papertext p-4 text-[14px] leading-snug space-y-3">
              <p>{disclaimerFor("en", firmName)}</p>
              <p className="border-t border-papertext/15 pt-3">{disclaimerFor("es", firmName)}</p>
            </div>
          </section>

          <section>
            <div className="field-label text-dim pb-2">Human review is forced when…</div>
            <ul className="rounded-sm border border-ink-line bg-ink-raised p-4 space-y-2 text-[15px]">
              <li className="flex gap-2.5">
                <span className="text-manila font-mono">▸</span> Extraction confidence falls below{" "}
                {(REVIEW_RULES.confidenceFloor * 100).toFixed(0)}%
              </li>
              <li className="flex gap-2.5">
                <span className="text-manila font-mono">▸</span> Any name matches the firm&apos;s
                conflict list — the reply is held entirely
              </li>
              <li className="flex gap-2.5">
                <span className="text-manila font-mono">▸</span> The routing is &ldquo;sign
                now&rdquo; — the best cases get the most scrutiny, not the least
              </li>
            </ul>
          </section>

          <section>
            <div className="field-label text-dim pb-2">Where the data lives</div>
            <div className="rounded-sm border border-ink-line bg-ink-raised p-4 text-[15px] space-y-2.5">
              <p>
                <span className="text-manila font-mono">▸</span> Client details stay in{" "}
                <span className="font-mono text-sm">data/store.json</span> on the firm&apos;s own
                machine. No analytics, no CRM sync, no third-party pixels.
              </p>
              <p>
                <span className="text-manila font-mono">▸</span> One outbound call exists: the
                message text goes to the Anthropic API for extraction, over TLS, and the
                structured result comes back. That is the entire data path.
              </p>
              <p>
                <span className="text-manila font-mono">▸</span> Filing deadlines come from a
                reviewed table in <span className="font-mono text-sm">lib/sol-table.ts</span>{" "}
                plus date arithmetic. A model that hallucinates a deadline is a malpractice
                generator, so the model is never asked for one.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
