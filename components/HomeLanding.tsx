import Link from "next/link";

import {
  AreaTabs,
  CHANNELS,
  Eyebrow,
  Foot,
  Header,
  HERO_GLOW,
  PIPELINE,
  PROBLEMS,
  Section,
  SEGMENTS,
  STEPS,
} from "./Landing";

// The public homepage at "/" — what a logged-out visitor sees at the root
// domain. Unlike Landing.tsx (one practice area's full pitch, reused at
// /personal-injury, /immigration, /criminal-defense, /family-law), this page
// speaks for all four at once and its only job is to get a visitor to the
// right one. Same Night Docket identity, same shared sections (reused from
// Landing.tsx) — only the hero, guarantee strip, "what it does" cards, and
// FAQ are rewritten to make no area-specific claim.

const AREA_PICKS = [
  {
    glyph: "PI",
    title: "Personal injury",
    body: "Injuries, treatment status, liability — the filing deadline computed, never guessed.",
    href: "/personal-injury",
  },
  {
    glyph: "IM",
    title: "Immigration",
    body: "Status as stated, notices, hearing dates — flags a detained person or an imminent hearing.",
    href: "/immigration",
  },
  {
    glyph: "CD",
    title: "Criminal defense",
    body: "Who, where, the court calendar — never a word of what happened.",
    href: "/criminal-defense",
  },
  {
    glyph: "FL",
    title: "Family law",
    body: "The other party, the court calendar — flags a reported safety concern immediately.",
    href: "/family-law",
  },
];

const HOME_CHECKLIST = [
  "Reads voicemail, text, WhatsApp, email, and your web form",
  "Builds a structured case file — the fields fit your practice area",
  "Flags what's urgent: a detained client, a court date, a safety concern",
  "Drafts the reply — a human approves every send",
];

const HOME_GUARANTEES = [
  { mark: "☑", text: "Nothing sends without a human clicking approve" },
  { mark: "⏱", text: "Deadlines come from a reviewed table or exactly what the sender was told — never guessed by AI" },
  { mark: "⛔", text: "No legal advice, no case values or outcome predictions, by construction" },
  { mark: "▤", text: "Every action lands in an append-only audit trail" },
];

const HOME_CARDS = [
  {
    n: "01",
    title: "Reads the mess",
    body: "A rambling voicemail, an ALL-CAPS text, a half-empty form, a WhatsApp in Spanish — each becomes a structured case file built for your practice area: the facts that matter, nothing invented, and the exact questions intake still needs to ask.",
  },
  {
    n: "02",
    title: "Knows what it must never do",
    body: "No legal advice. No case values or outcome predictions. No implied attorney-client relationship. Deadlines come from a reviewed table or exactly what the sender was told — never from the AI — and stay hidden until an attorney at your firm signs off.",
  },
  {
    n: "03",
    title: "Your finger on Send",
    body: "Every reply waits on your review screen, editable, with edits logged. Conflict matches are held for an admin. An append-only audit trail records who approved what, and when.",
  },
];

const HOME_FAQS = [
  {
    q: "Does Nightshift give legal advice?",
    a: "No — by construction, not by promise. The system prompt forbids legal advice, case-value or outcome predictions, and any implied attorney-client relationship, and every reply carries a disclaimer appended by application code, in the sender's language.",
  },
  {
    q: "Is this the same product for every practice area?",
    a: "One codebase, one trust boundary, four case-file shapes. Each practice area gets its own extraction prompt, its own fields, and its own never-do list — see the page for your area for the specifics.",
  },
  {
    q: "Who decides the deadline?",
    a: "Your attorney does. Where a reviewed table exists (personal injury, immigration, criminal defense) it's computed from that table plus date arithmetic, never from the AI. Where none exists safely (family law), only a date the sender was actually told is shown, exactly as stated. Either way it stays hidden from reviewers until an attorney at your firm acknowledges it in Settings.",
  },
  {
    q: "Will this replace our intake staff?",
    a: "No. Nightshift reads, sorts, scores, and drafts. A person at your firm reviews and approves every outbound reply before it sends — edits included and logged.",
  },
  {
    q: "What if a lead matches an existing client or the other side of a case?",
    a: "It's checked against your firm's conflict list automatically. A match holds the reply and requires an admin to release it — nothing goes out on a conflicted lead by accident.",
  },
  {
    q: "What channels does it cover?",
    a: "Voicemail, SMS, WhatsApp, email, and your web intake form — one desk, every channel, so nothing depends on which number or inbox a lead happened to use.",
  },
];

export default function HomeLanding() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <Section className="pt-12 pb-10" style={HERO_GLOW}>
          <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-10 items-center">
            <div>
              <AreaTabs active="home" />
              <div className="font-mono text-meter text-xl tabular-nums pb-3">3:12 AM</div>
              <h1 className="font-display font-bold uppercase tracking-wide text-4xl sm:text-5xl leading-[1.05]">
                <span className="text-paper">Nobody answers your law firm</span>
                <br />
                <span className="text-manila drop-shadow-[0_0_24px_rgba(255,176,32,0.35)]">at 3 AM.</span>
              </h1>
              <p className="text-dim text-lg mt-5 max-w-xl leading-relaxed">
                Personal injury, immigration, criminal defense, family law — whatever you
                practice, the same problem costs you cases. Nightshift reads every after-hours
                message, builds a structured case file, and drafts the reply.{" "}
                <span className="text-inktext">A person at your firm approves everything.</span>
              </p>

              <ul className="mt-6 space-y-2.5 max-w-md">
                {HOME_CHECKLIST.map((item) => (
                  <li key={item} className="flex gap-2.5 items-start text-[15px]">
                    <span className="text-ok font-mono leading-[1.4]" aria-hidden>
                      ☑
                    </span>
                    <span className="text-inktext leading-snug">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-3 mt-8">
                <Link
                  href="/signup"
                  className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-lg px-6 py-3 shadow-[0_10px_34px_-10px_rgba(224,168,62,0.55)] hover:bg-manila-deep hover:shadow-[0_10px_34px_-6px_rgba(224,168,62,0.7)] transition-shadow"
                >
                  Create your firm&apos;s desk
                </Link>
                <a
                  href="#how-it-works"
                  className="rounded-sm border-2 border-ink-line text-inktext font-display font-bold uppercase tracking-wider text-lg px-6 py-3 hover:border-manila hover:text-manila"
                >
                  See how it works
                </a>
              </div>
              <p className="field-label text-dim mt-4">
                Free for 14 days · your web intake form works in two minutes · we onboard you
                personally
              </p>

              <div className="flex flex-wrap gap-2 mt-7">
                {CHANNELS.map((c) => (
                  <span
                    key={c.glyph}
                    className="flex items-center gap-2 rounded-sm border border-ink-line bg-ink-raised px-3 py-1.5"
                  >
                    <span className="font-mono text-xs text-manila">{c.glyph}</span>
                    <span className="text-sm text-dim">{c.label}</span>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="field-label text-manila mb-3">Which one are you?</div>
              <div className="grid sm:grid-cols-2 gap-3" role="group" aria-label="Choose your practice area">
                {AREA_PICKS.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="group relative overflow-hidden rounded-sm border border-ink-line bg-ink-raised px-5 py-5 transition-all duration-200 hover:border-manila hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-12px_rgba(224,168,62,0.4)]"
                  >
                    <span
                      className="absolute top-0 left-0 right-0 h-0.5 origin-left scale-x-0 bg-manila transition-transform duration-300 group-hover:scale-x-100"
                      aria-hidden
                    />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-manila bg-manila/10 border border-manila/30 rounded-sm px-2 py-1 transition-colors group-hover:bg-manila group-hover:text-papertext">
                        {a.glyph}
                      </span>
                      <span
                        className="text-dim font-mono transition-all group-hover:translate-x-0.5 group-hover:text-manila"
                        aria-hidden
                      >
                        →
                      </span>
                    </div>
                    <h2 className="font-display font-bold uppercase tracking-wide text-lg text-paper mt-3">
                      {a.title}
                    </h2>
                    <p className="text-[13.5px] text-dim leading-snug mt-1.5">{a.body}</p>
                  </Link>
                ))}
              </div>
              <p className="text-dim text-[13px] mt-3">
                Each area has its own extraction prompt, its own case-file shape, and its own
                never-do list — pick yours to see the real screen.
              </p>
            </div>
          </div>
        </Section>

        {/* Guarantee strip */}
        <Section className="py-8">
          <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOME_GUARANTEES.map((g) => (
              <div key={g.text} className="flex gap-3 items-start">
                <span className="text-meter font-mono text-lg leading-none pt-0.5">{g.mark}</span>
                <span className="text-[14px] text-dim leading-snug">{g.text}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* The problem */}
        <Section className="py-14">
          <Eyebrow>Why cases go cold</Eyebrow>
          <h2 className="font-display font-bold uppercase tracking-wide text-3xl text-paper max-w-2xl leading-tight">
            The problem isn&apos;t getting leads. It&apos;s what happens after they arrive.
          </h2>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {PROBLEMS.map((p) => (
              <div key={p.n} className="rounded-sm border border-ink-line bg-ink-raised px-5 py-5">
                <span className="font-mono text-meter text-sm">{p.n}</span>
                <h3 className="font-display font-bold uppercase tracking-wide text-lg text-paper mt-2 mb-2">
                  {p.title}
                </h3>
                <p className="text-[15px] text-dim leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Three cards */}
        <Section className="py-14">
          <Eyebrow>What Nightshift does</Eyebrow>
          <h2 className="font-display font-bold uppercase tracking-wide text-3xl text-paper max-w-2xl leading-tight mb-8">
            The trust boundary is the product.
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {HOME_CARDS.map((c) => (
              <div key={c.n} className="rounded-sm border border-ink-line bg-ink-raised px-5 py-5">
                <span className="font-mono text-manila text-sm">{c.n}</span>
                <h3 className="font-display font-bold uppercase tracking-wide text-xl text-paper mt-2 mb-2">
                  {c.title}
                </h3>
                <p className="text-[15px] text-dim leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-sm border border-ink-line bg-ink-raised px-5 py-6">
            <div className="field-label text-dim mb-4">Where every lead goes, every time</div>
            <div className="grid sm:grid-cols-4 gap-3 sm:gap-0 sm:items-stretch">
              {PIPELINE.map((p, i) => (
                <div key={p.n} className="flex sm:items-center">
                  <div className="flex-1">
                    <span className="font-mono text-meter text-xs">{p.n}</span>
                    <div className="font-display font-bold uppercase tracking-wide text-[15px] text-paper mt-1">
                      {p.title}
                    </div>
                    <p className="text-[13px] text-dim leading-snug mt-1">
                      {p.n === "02" ? "The raw message becomes a case file — the fields fit your practice area." : p.body}
                    </p>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <span
                      className="hidden sm:block text-ink-line font-mono text-lg px-2 shrink-0"
                      aria-hidden
                    >
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Who it's for */}
        <Section className="py-14">
          <Eyebrow>Built for your firm&apos;s size</Eyebrow>
          <h2 className="font-display font-bold uppercase tracking-wide text-3xl text-paper max-w-2xl leading-tight mb-8">
            The same desk, whether it&apos;s you or a growing team.
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {SEGMENTS.map((s) => (
              <div key={s.title} className="rounded-sm border border-ink-line bg-ink-raised px-5 py-5">
                <h3 className="font-display font-bold uppercase tracking-wide text-lg text-paper mb-2">
                  {s.title}
                </h3>
                <p className="text-[15px] text-dim leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* How it starts */}
        <Section id="how-it-works" className="py-14">
          <Eyebrow>Getting started</Eyebrow>
          <h2 className="font-display font-bold uppercase tracking-wide text-3xl text-paper text-center max-w-xl mx-auto leading-tight mb-10">
            Working in two minutes, wired in a week
          </h2>
          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-[22px] left-[16.6%] right-[16.6%] h-px bg-ink-line" />
            {STEPS.map((s) => (
              <div key={s.n} className="relative text-center md:text-left">
                <span className="relative z-10 inline-grid place-items-center w-11 h-11 rounded-full border-2 border-manila bg-ink text-manila font-display font-bold">
                  {s.n}
                </span>
                <h3 className="font-display font-bold uppercase tracking-wide text-lg text-paper mt-4 mb-2">
                  {s.title}
                </h3>
                <p className="text-[15px] text-dim leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* FAQ */}
        <Section id="faq" className="py-14">
          <Eyebrow>Before you sign up</Eyebrow>
          <h2 className="font-display font-bold uppercase tracking-wide text-3xl text-paper max-w-2xl leading-tight mb-8">
            Questions firms ask us first
          </h2>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            {HOME_FAQS.map((f) => (
              <div key={f.q} className="border-t border-ink-line pt-4">
                <h3 className="font-display font-bold text-[17px] text-paper mb-1.5">{f.q}</h3>
                <p className="text-[15px] text-dim leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Final CTA */}
        <Section className="py-16">
          <div className="rounded-sm border-2 border-manila/60 bg-ink-raised px-8 py-12 text-center">
            <h2 className="font-display font-bold uppercase tracking-wide text-3xl sm:text-4xl text-paper leading-tight max-w-2xl mx-auto">
              Wake up to organized cases, not a chaotic inbox.
            </h2>
            <p className="text-dim text-lg mt-4 max-w-xl mx-auto">
              Free for 14 days. Your intake form is live in two minutes — we handle the rest with
              you on a personal onboarding call.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
              <Link
                href="/signup"
                className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-lg px-6 py-3 shadow-[0_10px_34px_-10px_rgba(224,168,62,0.55)] hover:bg-manila-deep hover:shadow-[0_10px_34px_-6px_rgba(224,168,62,0.7)] transition-shadow"
              >
                Create your firm&apos;s desk
              </Link>
              <a
                href="mailto:support@thedigitaltutor.net"
                className="rounded-sm border-2 border-ink-line text-inktext font-display font-bold uppercase tracking-wider text-lg px-6 py-3 hover:border-manila hover:text-manila"
              >
                Talk to us first
              </a>
            </div>
          </div>
        </Section>
      </main>
      <Foot />
    </div>
  );
}
