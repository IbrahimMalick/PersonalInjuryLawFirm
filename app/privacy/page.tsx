import Link from "next/link";

export const metadata = { title: "Privacy Policy — Nightshift" };

// TEMPLATE POLICY — have your counsel review and finalize before public launch.
// Bracketed items need real values.

const EFFECTIVE = "September 2, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-6 py-10">
      <article className="max-w-[760px] mx-auto rounded-sm bg-paper text-papertext px-10 py-10 leading-relaxed text-[15.5px] space-y-5">
        <header>
          <h1 className="font-display font-bold uppercase tracking-wide text-3xl">
            Privacy Policy
          </h1>
          <p className="text-paperdim text-sm mt-1">Effective {EFFECTIVE} · Draft for counsel review</p>
        </header>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            Two kinds of people, two roles
          </h2>
          <p>
            <strong>Firm users</strong> (attorneys and staff who create accounts): we are the
            controller of your account data. <strong>Prospective clients</strong> (people who
            contact a firm through channels the firm connects to Nightshift): the firm is the
            controller of your information; we process it on the firm&apos;s behalf to run
            their intake desk. If you contacted a law firm and have questions about your
            information, contact that firm — we act on their instructions.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            What we collect
          </h2>
          <p>
            <strong>Account data:</strong> name, work email, password hash, firm details,
            actions you take in the product (kept in an audit log). <strong>Inquiry data,
            processed for firms:</strong> the content of messages sent to the firm (which may
            include health and injury details), sender contact details, call metadata and
            voicemail recordings/transcripts from the telephony provider, and the AI-generated
            case summaries and draft replies. <strong>Billing:</strong> handled by Stripe; we
            never see full card numbers. <strong>Technical:</strong> logs and IP addresses for
            security and rate limiting. We use no advertising trackers.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            How inquiry data is used
          </h2>
          <p>
            Solely to provide the Service to the firm: message text is sent to our AI provider
            (Anthropic) to produce the structured summary and draft reply; deadlines are
            computed by our own code; conflict checks run against the firm&apos;s own list.
            We do not sell personal information, use it for advertising, or use it to train AI
            models. Outbound replies are sent only after a person at the firm approves them.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            Subprocessors
          </h2>
          <p>
            Anthropic (AI processing of message text), GoHighLevel (email), Twilio (phone,
            SMS, WhatsApp), Stripe (payments), Vercel and Neon (hosting and storage). Each
            receives only what its function requires.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            Security and retention
          </h2>
          <p>
            Data is encrypted in transit; access is scoped per firm and enforced on every
            query; passwords are hashed (bcrypt); consequential actions are recorded in an
            append-only audit log. We retain firm data for the life of the subscription and
            delete or return it on request within 30 days of termination, except records we
            must keep for legal or security purposes.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            Your choices
          </h2>
          <p>
            Firm users can access and correct account data in the product and request deletion
            at info@thedigitaltutor.net. Depending on where you live (e.g., California, EU/UK), you may
            have additional rights — access, correction, deletion, portability — which we
            honor directly for account data and support the firm in honoring for inquiry data.
            We respond within the time the applicable law requires.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            Changes and contact
          </h2>
          <p>
            We&apos;ll post changes here and notify firm admins of material ones. Questions:
            info@thedigitaltutor.net · The Digital Tutor LLC, 3134 Decatur Ave, Bronx, NY 10467.
          </p>
        </section>

        <footer className="border-t border-papertext/15 pt-4 text-sm text-paperdim">
          <Link href="/" className="underline underline-offset-4">
            ← Back to Nightshift
          </Link>
        </footer>
      </article>
    </div>
  );
}
