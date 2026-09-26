"use client";

import {
  conductRules,
  CRIMINAL_REVIEW_RULES,
  criminalReplyFor,
  disclaimerFor,
  IMMIGRATION_REVIEW_RULES,
  REVIEW_RULES,
  timeCriticalAckFor,
} from "@/lib/guardrails";
import type { PracticeArea } from "@/lib/schema";

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

const IMMIGRATION_NEVER = [
  {
    title: "No legal advice",
    body: "The engine routes inquiries. It never applies immigration law to a person's facts, never says 'you qualify,' never advises anyone what to do.",
  },
  {
    title: "No predictions",
    body: "It will not predict eligibility, approval odds, or processing times — and will not advise whether to file, travel, leave the country, or attend a hearing.",
  },
  {
    title: "No status conclusions",
    body: "It records what the sender says as something they said. It never states anyone's immigration status as a legal conclusion, and never asks for an A-number, passport, or SSN.",
  },
  {
    title: "Nothing signed, nothing sent",
    body: "Every draft is queued for a person. Time-critical leads alert the team immediately. The Send button is a human's finger, not a webhook.",
  },
];

const CRIMINAL_NEVER = [
  {
    title: "No legal advice",
    body: "The engine routes inquiries. It never applies criminal law to a person's facts, never predicts an outcome, a sentence, or a plea, and never advises anyone what to do.",
  },
  {
    title: "No talk of the facts",
    body: "It never records, repeats, or asks about what happened, and never asks whether the person did it. Anything written before a lawyer is engaged can be used against them.",
  },
  {
    title: "No advice on rights",
    body: "It never advises anyone whether to talk to police, waive a right, consent to a search, post bail, take a plea, or attend a court date.",
  },
  {
    title: "Every reply is fixed text",
    body: "The model writes no reply at all. Code sends reviewed wording that also asks the sender not to describe what happened. A person approves it — the Send button is a human's finger, not a webhook.",
  },
];

export default function GuardrailsPanel({
  firmName,
  practiceArea = "personal_injury",
  variant = "demo",
}: {
  firmName: string;
  practiceArea?: PracticeArea;
  /** "demo" is the filmable sales demo (local store.json); "product" is a live firm. */
  variant?: "demo" | "product";
}) {
  const immigration = practiceArea === "immigration";
  const criminal = practiceArea === "criminal_defense";
  const never = criminal ? CRIMINAL_NEVER : immigration ? IMMIGRATION_NEVER : NEVER;
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
        {never.map((n, i) => (
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
            {conductRules(firmName, practiceArea)}
          </pre>
        </section>

        <div className="space-y-4">
          <section>
            <div className="field-label text-dim pb-2">
              The disclaimer appended to every auto-reply — by code, not by the model
            </div>
            <div className="rounded-sm bg-paper text-papertext p-4 text-[14px] leading-snug space-y-3">
              <p>{disclaimerFor("en", firmName, practiceArea)}</p>
              <p className="border-t border-papertext/15 pt-3">
                {disclaimerFor("es", firmName, practiceArea)}
              </p>
            </div>
          </section>

          {criminal && (
            <section>
              <div className="field-label text-dim pb-2">
                The reply itself — written by code for every lead, never by the model
              </div>
              <div className="rounded-sm bg-paper text-papertext p-4 text-[14px] leading-snug space-y-3">
                <p>{criminalReplyFor("en", firmName, false)}</p>
                <p className="border-t border-papertext/15 pt-3">
                  {criminalReplyFor("es", firmName, false)}
                </p>
              </div>
              <div className="field-label text-dim pt-3 pb-2">
                When someone may be in custody or a court date is close
              </div>
              <div className="rounded-sm bg-paper text-papertext p-4 text-[14px] leading-snug space-y-3">
                <p>{criminalReplyFor("en", firmName, true)}</p>
                <p className="border-t border-papertext/15 pt-3">
                  {criminalReplyFor("es", firmName, true)}
                </p>
              </div>
            </section>
          )}

          {immigration && (
            <section>
              <div className="field-label text-dim pb-2">
                For a detained person or an imminent hearing — the draft is written by code
              </div>
              <div className="rounded-sm bg-paper text-papertext p-4 text-[14px] leading-snug space-y-3">
                <p>{timeCriticalAckFor("en", firmName)}</p>
                <p className="border-t border-papertext/15 pt-3">
                  {timeCriticalAckFor("es", firmName)}
                </p>
              </div>
            </section>
          )}

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
              {criminal && CRIMINAL_REVIEW_RULES.forcedOnTimeCritical && (
                <li className="flex gap-2.5">
                  <span className="text-stamp font-mono">▸</span> The lead is time-critical —
                  someone may be in custody, there is an active warrant, or a court date or
                  deadline is within {CRIMINAL_REVIEW_RULES.timeCriticalWindowDays} days. It is
                  never routed to decline or follow-up, and the team is alerted at once.
                </li>
              )}
              {immigration && IMMIGRATION_REVIEW_RULES.forcedOnTimeCritical && (
                <li className="flex gap-2.5">
                  <span className="text-stamp font-mono">▸</span> The lead is time-critical — a
                  person may be detained, or a hearing or deadline is within{" "}
                  {IMMIGRATION_REVIEW_RULES.timeCriticalWindowDays} days. It is never routed to
                  decline or follow-up, and the team is alerted at once.
                </li>
              )}
            </ul>
          </section>

          <section>
            <div className="field-label text-dim pb-2">Where the data lives</div>
            <div className="rounded-sm border border-ink-line bg-ink-raised p-4 text-[15px] space-y-2.5">
              {variant === "product" ? (
                <>
                  <p>
                    <span className="text-manila font-mono">▸</span> Your firm&apos;s leads live in
                    the platform database. Every query is scoped to your firm — other firms
                    cannot see them.
                  </p>
                  <p>
                    <span className="text-manila font-mono">▸</span> The model&apos;s only data
                    path: the message text goes to the Anthropic API for extraction, over TLS, and
                    the structured result comes back.
                  </p>
                  <p>
                    <span className="text-manila font-mono">▸</span> Approved replies go out
                    through the email or text provider configured for your account. If the
                    platform operator has connected a CRM (GoHighLevel), a summary of each
                    processed lead is copied there — with no computed deadline until your
                    attorney has acknowledged the deadline table.
                  </p>
                  {criminal && (
                    <p>
                      <span className="text-manila font-mono">▸</span> The case file holds only
                      who, where, and the court calendar — it has no field for what allegedly
                      happened. The message itself is stored as it was received, and is never
                      copied into the CRM.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    <span className="text-manila font-mono">▸</span> Client details stay in{" "}
                    <span className="font-mono text-sm">data/store.json</span> on the
                    firm&apos;s own machine. No analytics, no CRM sync, no third-party pixels.
                  </p>
                  <p>
                    <span className="text-manila font-mono">▸</span> One outbound call exists:
                    the message text goes to the Anthropic API for extraction, over TLS, and the
                    structured result comes back. That is the entire data path.
                  </p>
                </>
              )}
              <p>
                <span className="text-manila font-mono">▸</span> Filing deadlines come from a
                reviewed table in{" "}
                <span className="font-mono text-sm">
                  {criminal
                    ? "lib/criminal-deadlines.ts"
                    : immigration
                      ? "lib/immigration-deadlines.ts"
                      : "lib/sol-table.ts"}
                </span>{" "}
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
