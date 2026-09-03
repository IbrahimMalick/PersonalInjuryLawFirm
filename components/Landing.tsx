import Link from "next/link";

// Public marketing page — what a logged-out visitor sees at the root.
// Same Night Docket identity as the product; the pitch is the product.

function Foot() {
  return (
    <footer className="border-t border-ink-line px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-dim">
      <span className="font-mono">Nightshift — the intake desk that doesn&apos;t sleep.</span>
      <span className="flex gap-6">
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
        <section className="px-6 pt-14 pb-12 max-w-[1000px] mx-auto text-center">
          <div className="font-mono text-meter text-2xl tabular-nums pb-4">3:12 AM</div>
          <h1 className="font-display font-bold uppercase tracking-wide text-5xl text-paper leading-tight">
            Somebody just called your firm
            <br />
            about a car accident.
          </h1>
          <p className="text-dim text-xl mt-5 max-w-2xl mx-auto leading-relaxed">
            Nobody answers a law office at 3:12 AM — so that case signs with whoever answers
            first. Nightshift reads every after-hours voicemail, text, email, and web form,
            builds the case file, checks your conflicts, and drafts the reply.{" "}
            <span className="text-inktext">A person at your firm approves everything.</span>
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <Link
              href="/signup"
              className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-lg px-6 py-3 hover:bg-manila-deep"
            >
              Create your firm&apos;s desk
            </Link>
          </div>
          <p className="field-label text-dim mt-3">
            Free for 14 days · your web intake form works in two minutes · we onboard you
            personally
          </p>
        </section>

        {/* Three cards */}
        <section className="px-6 pb-12 max-w-[1100px] mx-auto grid grid-cols-3 gap-4">
          {[
            {
              title: "Reads the mess",
              body: "A rambling voicemail, an ALL-CAPS text, a half-empty form, a WhatsApp in Spanish — each becomes a structured case file: injuries, treatment status, liability, priority score, and the exact questions intake still needs to ask.",
            },
            {
              title: "Knows what it must never do",
              body: "No legal advice. No case values. No implied attorney-client relationship. Filing deadlines come from a reviewed table and date math — never from the AI — and stay hidden until an attorney at your firm signs off on the table.",
            },
            {
              title: "Your finger on Send",
              body: "Every reply waits on your review screen, editable, with edits logged. Conflict matches are held for an admin. An append-only audit trail records who approved what, and when.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-sm border border-ink-line bg-ink-raised px-5 py-5">
              <h2 className="font-display font-bold uppercase tracking-wide text-xl text-paper pb-2">
                {c.title}
              </h2>
              <p className="text-[15px] text-dim leading-relaxed">{c.body}</p>
            </div>
          ))}
        </section>

        {/* Versus answering services */}
        <section className="px-6 pb-16 max-w-[1000px] mx-auto">
          <h2 className="font-display font-bold uppercase tracking-wide text-2xl text-paper pb-3 text-center">
            &ldquo;We already pay an answering service&rdquo;
          </h2>
          <p className="text-dim text-center max-w-2xl mx-auto leading-relaxed pb-8">
            Keep it if your callers love a live voice — plenty of firms run both. The
            difference is what lands on your desk the next morning. A receptionist takes a
            message; Nightshift makes the case ready to act on — from calls <em>and</em> the
            texts, emails, web forms, and WhatsApps no receptionist ever sees. One flat
            monthly price. No per-call meter running on spam and wrong numbers.
          </p>
          <div className="grid grid-cols-2 gap-4 items-start">
            <div>
              <p className="field-label text-dim pb-2">What a message service delivers</p>
              <div className="rounded-sm border border-ink-line bg-ink-raised px-5 py-5 font-mono text-[14px] text-dim leading-loose">
                <p className="text-inktext">WHILE YOU WERE OUT</p>
                <p>Caller: Dana O.</p>
                <p>Re: car accident (?)</p>
                <p>Msg: &ldquo;please call her back&rdquo;</p>
                <p>Taken: 3:12 AM</p>
              </div>
            </div>
            <div>
              <p className="field-label text-dim pb-2">What Nightshift delivers</p>
              <div className="rounded-sm bg-paper text-papertext px-5 py-5 text-[14px] leading-loose">
                <p className="font-display font-bold uppercase tracking-wide text-lg">
                  Dana Ortiz — motor vehicle
                </p>
                <p>
                  <span className="text-paperdim">Priority</span> 82 · ER visit · clear
                  liability
                </p>
                <p>
                  <span className="text-paperdim">Conflicts</span> none against your list
                </p>
                <p>
                  <span className="text-paperdim">Deadline</span> computed by table + date
                  math, never AI
                </p>
                <p>
                  <span className="text-paperdim">Reply</span> drafted — waiting on your
                  approval
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it starts */}
        <section className="px-6 pb-16 max-w-[800px] mx-auto">
          <h2 className="font-display font-bold uppercase tracking-wide text-2xl text-paper pb-4 text-center">
            Working in two minutes, wired in a week
          </h2>
          <ol className="space-y-3 text-[16px] text-dim">
            <li className="flex gap-3">
              <span className="font-mono text-meter shrink-0">01</span>
              <span>
                <span className="text-inktext">Sign up.</span> Your firm&apos;s intake form is
                live immediately — link it from your website and leads start flowing today.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-meter shrink-0">02</span>
              <span>
                <span className="text-inktext">We onboard you personally.</span> On one call we
                load your conflict list, walk the deadline table with your attorney, and stand
                up a dedicated intake phone number — forward your office line after hours.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-meter shrink-0">03</span>
              <span>
                <span className="text-inktext">Wake up to organized cases.</span> Triaged,
                scored, conflict-checked, each with a drafted reply waiting for one click of
                human judgment.
              </span>
            </li>
          </ol>
        </section>
      </main>
      <Foot />
    </div>
  );
}
