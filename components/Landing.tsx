import Link from "next/link";
import Image from "next/image";

// Public marketing page — what a logged-out visitor sees at the root.
// Same Night Docket identity as the product; the pitch is the product.

const CHANNELS = [
  { glyph: "VM", label: "Voicemail" },
  { glyph: "SMS", label: "Text" },
  { glyph: "WA", label: "WhatsApp" },
  { glyph: "EM", label: "Email" },
  { glyph: "WEB", label: "Web form" },
];

const GUARANTEES = [
  { mark: "☑", text: "Nothing sends without a human clicking approve" },
  { mark: "⏱", text: "Deadlines computed from a reviewed table — never guessed by AI" },
  { mark: "⛔", text: "No legal advice, no case values, by construction" },
  { mark: "▤", text: "Every action lands in an append-only audit trail" },
];

const PROBLEMS = [
  {
    n: "01",
    title: "The call comes in at the worst time",
    body: "Nobody's at the desk at 3 AM. The caller doesn't wait — they hang up and dial the next firm on the list.",
  },
  {
    n: "02",
    title: "Leads scatter across five channels",
    body: "Voicemail, SMS, WhatsApp, email, the web form — each lands somewhere different, and stitching them together by hand is how good cases get missed.",
  },
  {
    n: "03",
    title: "Morning starts with cleanup, not casework",
    body: "By the time someone opens the inbox, it's a pile of unsorted messages instead of a queue of qualified, prioritized cases.",
  },
];

const CARDS = [
  {
    n: "01",
    title: "Reads the mess",
    body: "A rambling voicemail, an ALL-CAPS text, a half-empty form, a WhatsApp in Spanish — each becomes a structured case file: injuries, treatment status, liability, priority score, and the exact questions intake still needs to ask.",
  },
  {
    n: "02",
    title: "Knows what it must never do",
    body: "No legal advice. No case values. No implied attorney-client relationship. Filing deadlines come from a reviewed table and date math — never from the AI — and stay hidden until an attorney at your firm signs off on the table.",
  },
  {
    n: "03",
    title: "Your finger on Send",
    body: "Every reply waits on your review screen, editable, with edits logged. Conflict matches are held for an admin. An append-only audit trail records who approved what, and when.",
  },
];

const PIPELINE = [
  { n: "01", title: "Capture", body: "Every channel lands in one desk — voicemail, text, WhatsApp, email, the web form." },
  { n: "02", title: "Structure", body: "The raw message becomes a case file: injuries, treatment status, liability, priority score." },
  { n: "03", title: "Verify", body: "Checked against your conflict list and the reviewed deadline table — never guessed by the AI." },
  { n: "04", title: "Approve & send", body: "A person at your firm reviews the drafted reply, edits if needed, and clicks send." },
];

const SEGMENTS = [
  {
    title: "Solo practitioners",
    body: "Capture every after-hours call without hiring overnight staff — the desk runs while you're in court or asleep.",
  },
  {
    title: "Small firms",
    body: "One shared inbox across the whole team, so a lead never sits unclaimed between attorneys or gets worked twice.",
  },
  {
    title: "Growing firms",
    body: "Add reviewers under Settings as you hire — every new person triages against the same conflict list and deadline table from day one, no retraining a receptionist.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Sign up",
    body: "Your firm's intake form is live immediately — link it from your website and leads start flowing today.",
  },
  {
    n: "02",
    title: "We onboard you personally",
    body: "On one call we load your conflict list, walk the deadline table with your attorney, and stand up a dedicated intake phone number.",
  },
  {
    n: "03",
    title: "Wake up to organized cases",
    body: "Triaged, scored, conflict-checked, each with a drafted reply waiting for one click of human judgment.",
  },
];

const FAQS = [
  {
    q: "Does Nightshift give legal advice?",
    a: "No — by construction, not by promise. The system prompt forbids legal advice, case-value estimates, and any implied attorney-client relationship, and every reply carries a disclaimer appended by application code, in the sender's language.",
  },
  {
    q: "Who decides the filing deadline?",
    a: "Your attorney does. The deadline is computed from a reviewed statute-of-limitations table plus date arithmetic — never from the AI — and stays hidden from reviewers until an attorney at your firm reviews that table and acknowledges it in Settings.",
  },
  {
    q: "Will this replace our intake staff?",
    a: "No. Nightshift reads, sorts, scores, and drafts. A person at your firm reviews and approves every outbound reply before it sends — edits included and logged.",
  },
  {
    q: "What happens if it can't figure out a message?",
    a: "It's flagged \"needs attention\" with the raw message attached, so a person looks at it. Real leads never get a canned answer to paper over a failure.",
  },
  {
    q: "What if a lead matches an existing client or an adverse party?",
    a: "It's checked against your firm's conflict list automatically. A match holds the reply and requires an admin to release it — nothing goes out on a conflicted lead by accident.",
  },
  {
    q: "What channels does it cover?",
    a: "Voicemail, SMS, WhatsApp, email, and your web intake form — one desk, every channel, so nothing depends on which number or inbox a lead happened to use.",
  },
];

function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`px-6 ${className}`}>
      <div className="max-w-[1100px] mx-auto">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="field-label text-manila mb-3">{children}</div>;
}

function Foot() {
  return (
    <footer className="border-t border-ink-line px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-dim">
      <span className="font-mono">
        Nightshift — the intake desk that doesn&apos;t sleep. Built by The Digital Tutor.
      </span>
      <span className="flex flex-wrap gap-6">
        <a
          href="mailto:support@thedigitaltutor.net"
          className="hover:text-inktext underline underline-offset-4"
        >
          support@thedigitaltutor.net
        </a>
        <Link href="/terms" className="hover:text-inktext underline underline-offset-4">
          Terms of Service
        </Link>
        <Link href="/privacy" className="hover:text-inktext underline underline-offset-4">
          Privacy Policy
        </Link>
        <Link href="/login" className="hover:text-inktext underline underline-offset-4">
          Sign in
        </Link>
      </span>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-sm border-2 border-meter text-meter font-display font-bold text-lg">
            N
          </span>
          <span className="font-display font-bold text-xl uppercase tracking-widest text-paper">
            Nightshift
          </span>
        </span>
        <span className="flex items-center gap-4">
          <Link href="/login" className="field-label text-dim hover:text-inktext">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider px-4 py-2 hover:bg-manila-deep"
          >
            Start free
          </Link>
        </span>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <Section className="pt-12 pb-10">
          <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-10 items-center">
            <div>
              <div className="font-mono text-meter text-xl tabular-nums pb-3">3:12 AM</div>
              <h1 className="font-display font-bold uppercase tracking-wide text-4xl sm:text-5xl text-paper leading-[1.05]">
                Somebody just called your firm about a car accident.
              </h1>
              <p className="text-dim text-lg mt-5 max-w-xl leading-relaxed">
                Nobody answers a law office at 3:12 AM — so that case signs with whoever answers
                first. Nightshift reads every after-hours voicemail, text, email, and web form,
                builds the case file, checks your conflicts, and drafts the reply.{" "}
                <span className="text-inktext">A person at your firm approves everything.</span>
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-8">
                <Link
                  href="/signup"
                  className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-lg px-6 py-3 hover:bg-manila-deep"
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
              <div className="rounded-sm border border-ink-line bg-ink-raised p-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
                <Image
                  src="/screenshot.png"
                  alt="Nightshift's Live Desk showing an inbound voicemail turned into a structured case file, with the filing deadline computed and a reply queued for review"
                  width={1440}
                  height={900}
                  className="w-full h-auto rounded-[2px]"
                  priority
                />
              </div>
              <p className="field-label text-dim mt-3 text-center">
                The actual product — a real case file, built from a real voicemail
              </p>
            </div>
          </div>
        </Section>

        {/* Guarantee strip */}
        <Section className="py-8">
          <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GUARANTEES.map((g) => (
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
            {CARDS.map((c) => (
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
                    <p className="text-[13px] text-dim leading-snug mt-1">{p.body}</p>
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
        <Section className="py-14">
          <Eyebrow>Before you sign up</Eyebrow>
          <h2 className="font-display font-bold uppercase tracking-wide text-3xl text-paper max-w-2xl leading-tight mb-8">
            Questions firms ask us first
          </h2>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            {FAQS.map((f) => (
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
                className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-lg px-6 py-3 hover:bg-manila-deep"
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
