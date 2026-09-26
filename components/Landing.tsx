import Link from "next/link";
import Image from "next/image";
import type { PracticeArea } from "@/lib/schema";

// Public marketing page — what a logged-out visitor sees at the root.
// Same Night Docket identity as the product; the pitch is the product.

const CHANNELS = [
  { glyph: "VM", label: "Voicemail" },
  { glyph: "SMS", label: "Text" },
  { glyph: "WA", label: "WhatsApp" },
  { glyph: "EM", label: "Email" },
  { glyph: "WEB", label: "Web form" },
];

const HERO_CHECKLIST = [
  "Reads voicemail, text, WhatsApp, email, and your web form",
  "Builds a structured case file automatically",
  "Checks conflicts and computes the filing deadline",
  "Drafts the reply — a human approves every send",
];

const HERO_STAGES = ["Captured", "Structured", "Verified", "Approved"];

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

// ── Immigration copy ─────────────────────────────────────────────────────────
// Everything below is a claim about what the product actually does for an
// immigration firm — no invented stats, no testimonials.

const IMMIGRATION_CHECKLIST = [
  "Reads voicemail, text, WhatsApp, email, and your web form — including Spanish",
  "Builds a structured case file: status as stated, notices, hearing dates",
  "Flags a detained person or an imminent hearing for immediate attention",
  "Drafts the reply — a human approves every send",
];

const IMMIGRATION_GUARANTEES = [
  { mark: "☑", text: "Nothing sends without a human clicking approve" },
  { mark: "⏱", text: "Deadlines computed from a reviewed table — never guessed by AI" },
  { mark: "⛔", text: "No legal advice, no eligibility or timing predictions, by construction" },
  { mark: "▤", text: "Every action lands in an append-only audit trail" },
];

const IMMIGRATION_CARDS = [
  {
    n: "01",
    title: "Reads the mess",
    body: "A rambling voicemail, a WhatsApp in Spanish, a half-empty form — each becomes a structured case file: status as the sender describes it, any notice or hearing date they mention, who is sponsoring, and the exact questions intake still needs to ask.",
  },
  {
    n: "02",
    title: "Knows what it must never do",
    body: "No legal advice. No predictions about eligibility, approval odds, or processing times. No advice on whether to file, travel, or attend a hearing. Deadlines come from a reviewed table and date math — never from the AI — and stay hidden until an attorney at your firm signs off on the table.",
  },
  {
    n: "03",
    title: "Your finger on Send",
    body: "Every reply waits on your review screen, editable, with edits logged. A detained person or an imminent hearing is flagged time-critical by code, alerts your team at once, and gets a brief acknowledgment draft — still sent only when a person approves it.",
  },
];

const IMMIGRATION_FAQS = [
  {
    q: "Does Nightshift give legal advice?",
    a: "No — by construction, not by promise. The system prompt forbids legal advice, predictions about eligibility, approval odds or processing times, advice on whether to file, travel, or attend a hearing, and any statement of someone's immigration status as a legal conclusion. Every reply carries a disclaimer appended by application code, in the sender's language.",
  },
  {
    q: "Who decides the filing deadline?",
    a: "Your attorney does. Deadlines — a response window after a notice, an appeal window, a hearing date — are computed from a reviewed table plus date arithmetic, never from the AI, and stay hidden from reviewers until an attorney at your firm reviews that table and acknowledges it in Settings.",
  },
  {
    q: "What happens when someone is detained or a hearing is close?",
    a: "Code — not the model — flags it time-critical. It is never routed to decline or follow-up, your team is emailed immediately (and reminded 30 minutes later if no one has replied), and the draft is a brief acknowledgment. A person still approves the send.",
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
    a: "It's checked against your firm's conflict list automatically — the applicant, a sponsor, or a named employer or relative. A match holds the reply and requires an admin to release it.",
  },
  {
    q: "What channels and languages does it cover?",
    a: "Voicemail, SMS, WhatsApp, email, and your web intake form. The public form and the reply disclaimer are in English and Spanish, and replies are drafted in the sender's language.",
  },
];

// ── Criminal defense copy ────────────────────────────────────────────────────
// Claims about what the product actually does for a criminal-defense firm — no
// invented stats, no testimonials. The distinctive claim is true by construction:
// the case file has no field for what allegedly happened, and the reply is fixed
// text that asks the sender not to describe it.

const CRIMINAL_CHECKLIST = [
  "Reads voicemail, text, WhatsApp, email, and your web form — including Spanish",
  "Builds a case file: who, where they are, the court calendar — never what happened",
  "Flags a person in custody, a warrant, or a court date this week for immediate attention",
  "Sends fixed, reviewed wording — a human approves every send",
];

const CRIMINAL_GUARANTEES = [
  { mark: "☑", text: "Nothing sends without a human clicking approve" },
  { mark: "⏱", text: "Court dates and deadlines computed from a reviewed table — never guessed by AI" },
  { mark: "⛔", text: "No legal advice, no predictions about outcomes, pleas, or sentences" },
  { mark: "▤", text: "Every action lands in an append-only audit trail" },
];

const CRIMINAL_CARDS = [
  {
    n: "01",
    title: "Records who and where — not what happened",
    body: "A frantic voicemail from a mother, a text from a jail phone, a half-empty form — each becomes a case file: who was arrested, where they are held, the court and next date, the charge as named, and the questions intake still needs to ask. It has no field for the incident, so it cannot record one.",
  },
  {
    n: "02",
    title: "Knows what it must never do",
    body: "No legal advice. No predictions about outcomes, pleas, or sentences. No advice on talking to police, posting bail, or attending court. The reply is fixed wording written by code — the model never drafts it — and asks the sender not to describe what happened. Deadlines come from a reviewed table and stay hidden until an attorney at your firm signs off on it.",
  },
  {
    n: "03",
    title: "Your finger on Send",
    body: "Every reply waits on your review screen, editable, with edits logged. A person in custody, an active warrant, or a court date within a week is flagged time-critical by code, alerts your team at once, and is never routed to decline or follow-up — still sent only when a person approves it.",
  },
];

const CRIMINAL_FAQS = [
  {
    q: "Does Nightshift give legal advice?",
    a: "No — by construction, not by promise. The system prompt forbids legal advice, predictions about outcomes, pleas, or sentences, and advice on whether to talk to police, waive a right, post bail, or attend court. Every reply carries a disclaimer appended by application code, in the sender's language.",
  },
  {
    q: "What if someone writes about what happened?",
    a: "The case file has no field for it, and the model is told never to record or repeat it. The reply — fixed wording, not model-written — asks the sender not to describe events in a text, email, or voicemail and says the attorney will speak with them directly. One honest limit: the message itself is stored as it was received, and your team can read it. Nightshift cannot stop someone typing it; it can decline to spread it.",
  },
  {
    q: "What happens when someone is in custody or a court date is close?",
    a: "Code — not the model — flags it time-critical. It is never routed to decline or follow-up, your team is emailed immediately (and reminded 30 minutes later if no one has replied), and the reply is the fixed urgent wording. A person still approves the send.",
  },
  {
    q: "Who decides the deadlines?",
    a: "Your attorney does. Court dates come from what the sender states; windows such as an appeal or a DUI license-hearing request are computed from a reviewed table plus date arithmetic, never from the AI. They vary by state and court, so they stay hidden from reviewers until an attorney at your firm reviews the table and acknowledges it in Settings.",
  },
  {
    q: "Will this replace our intake staff?",
    a: "No. Nightshift reads, sorts, scores, and flags. A person at your firm reviews and approves every outbound reply before it sends — edits included and logged.",
  },
  {
    q: "What if a lead matches an existing client or an adverse party?",
    a: "It's checked against your firm's conflict list automatically — the person charged, the sender, a co-defendant, or a named complainant. A match holds the reply and requires an admin to release it.",
  },
  {
    q: "What channels and languages does it cover?",
    a: "Voicemail, SMS, WhatsApp, email, and your web intake form. The public form and the reply are in English and Spanish, and the reply follows the sender's language.",
  },
];

interface HeroMedia {
  src: string;
  alt: string;
  label: string;
  caption: string;
}

interface AreaCopy {
  media: HeroMedia;
  /** The pipeline's "Structure" step names what each area's case file holds. */
  structureStep: string;
  headline: [string, string];
  lede: string;
  checklist: string[];
  guarantees: { mark: string; text: string }[];
  cards: { n: string; title: string; body: string }[];
  faqs: { q: string; a: string }[];
}

const AREA_COPY: Record<PracticeArea, AreaCopy> = {
  personal_injury: {
    media: {
      src: "/screenshot.png",
      alt: "Nightshift's Live Desk showing an inbound voicemail turned into a structured case file, with the filing deadline computed and a reply queued for review",
      label: "Real case file, not a mockup",
      caption: "A voicemail at 2:47 AM, read into a case file with the deadline computed and a reply waiting for a person to approve.",
    },
    structureStep: "The raw message becomes a case file: injuries, treatment status, liability, priority score.",
    headline: ["Somebody just called your firm", "about a car accident."],
    lede: "Nobody answers a law office at 3:12 AM — so that case signs with whoever answers first.",
    checklist: HERO_CHECKLIST,
    guarantees: GUARANTEES,
    cards: CARDS,
    faqs: FAQS,
  },
  immigration: {
    media: {
      src: "/screenshot-immigration.png",
      alt: "Nightshift's immigration case screen for a sample lead with a hearing days away: a red time-critical banner, the computed hearing deadline, what the sender told us, and a brief acknowledgment reply waiting for a person to approve",
      label: "Sample immigration case file",
      caption: "The real screen, filled with fictional sample data: a hearing days away is flagged time-critical by code, and the reply waits for a person to approve.",
    },
    structureStep: "The raw message becomes a case file: status as stated, notices, hearing dates, priority score.",
    headline: ["A frightened family just called your firm", "about a hearing next week."],
    lede: "Nobody answers a law office at 3:12 AM — and immigration matters can't always wait until morning. Nightshift reads every after-hours message, flags what's time-critical, and drafts the reply.",
    checklist: IMMIGRATION_CHECKLIST,
    guarantees: IMMIGRATION_GUARANTEES,
    cards: IMMIGRATION_CARDS,
    faqs: IMMIGRATION_FAQS,
  },
  criminal_defense: {
    media: {
      src: "/screenshot-criminal.png",
      alt: "Nightshift's criminal-defense case screen for a sample lead: a red time-critical banner for a person in custody, the computed deadlines, who and where with no account of events, and a fixed reply waiting for a person to approve",
      label: "Sample criminal-defense case file",
      caption: "The real screen, filled with fictional sample data: a person in custody is flagged time-critical by code, the case file holds no account of events, and the fixed reply waits for a person to approve.",
    },
    structureStep: "The raw message becomes a case file: who, where they are held, the court calendar, priority score.",
    headline: ["A mother just called your firm at 3 AM", "about a son in county jail."],
    lede: "Nobody answers a law office at 3:12 AM — and a person in custody can't wait until morning. Nightshift reads every after-hours message, flags what's time-critical, and never writes down what happened.",
    checklist: CRIMINAL_CHECKLIST,
    guarantees: CRIMINAL_GUARANTEES,
    cards: CRIMINAL_CARDS,
    faqs: CRIMINAL_FAQS,
  },
};

const AREA_TABS: { area: PracticeArea; label: string; href: string }[] = [
  { area: "personal_injury", label: "Personal injury", href: "/" },
  { area: "immigration", label: "Immigration", href: "/?area=immigration" },
  { area: "criminal_defense", label: "Criminal defense", href: "/?area=criminal" },
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

export default function Landing({ area = "personal_injury" }: { area?: PracticeArea }) {
  const copy = AREA_COPY[area];
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 gap-4">
        <span className="flex items-center gap-3 shrink-0">
          <span className="grid place-items-center w-9 h-9 rounded-sm border-2 border-meter text-meter font-display font-bold text-lg">
            N
          </span>
          <span className="font-display font-bold text-xl uppercase tracking-widest text-paper">
            Nightshift
          </span>
        </span>
        <nav className="hidden md:flex items-center gap-6" aria-label="Page sections">
          <a href="#how-it-works" className="field-label text-dim hover:text-inktext">
            How it works
          </a>
          <a href="#faq" className="field-label text-dim hover:text-inktext">
            FAQ
          </a>
        </nav>
        <span className="flex items-center gap-4 shrink-0">
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
              <div className="flex flex-wrap items-center gap-2 pb-5" role="group" aria-label="Practice area">
                <span className="field-label text-dim mr-1">Built for</span>
                {AREA_TABS.map((t) => (
                  <Link
                    key={t.area}
                    href={t.href}
                    aria-current={t.area === area ? "page" : undefined}
                    className={`rounded-sm border px-3 py-1 font-display text-sm font-bold uppercase tracking-wider ${
                      t.area === area
                        ? "border-manila bg-manila text-papertext"
                        : "border-ink-line text-dim hover:border-manila hover:text-manila"
                    }`}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
              <div className="font-mono text-meter text-xl tabular-nums pb-3">3:12 AM</div>
              <h1 className="font-display font-bold uppercase tracking-wide text-4xl sm:text-5xl leading-[1.05]">
                <span className="text-paper">{copy.headline[0]}</span>
                <br />
                <span className="text-manila">{copy.headline[1]}</span>
              </h1>
              <p className="text-dim text-lg mt-5 max-w-xl leading-relaxed">
                {copy.lede}{" "}
                <span className="text-inktext">A person at your firm approves everything.</span>
              </p>

              <ul className="mt-6 space-y-2.5 max-w-md">
                {copy.checklist.map((item) => (
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
              <div className="field-label text-manila mb-3">{copy.media.label}</div>
              <div className="rounded-sm border border-ink-line bg-ink-raised p-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
                <Image
                  src={copy.media.src}
                  alt={copy.media.alt}
                  width={1440}
                  height={900}
                  className="w-full h-auto rounded-[2px]"
                  priority
                />
              </div>
              <p className="text-dim text-[13px] mt-2">{copy.media.caption}</p>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {HERO_STAGES.map((s, i) => (
                  <div
                    key={s}
                    className={`rounded-sm border px-2 py-2 text-center ${
                      i === HERO_STAGES.length - 1
                        ? "border-ok/50 bg-ok/10"
                        : "border-ink-line bg-ink-raised"
                    }`}
                  >
                    <span
                      className={`font-mono text-[11px] uppercase tracking-wide ${
                        i === HERO_STAGES.length - 1 ? "text-ok" : "text-dim"
                      }`}
                    >
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Guarantee strip */}
        <Section className="py-8">
          <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {copy.guarantees.map((g) => (
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
            {copy.cards.map((c) => (
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
                    <p className="text-[13px] text-dim leading-snug mt-1">{p.n === "02" ? copy.structureStep : p.body}</p>
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
            {copy.faqs.map((f) => (
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
