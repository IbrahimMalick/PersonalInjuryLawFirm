import Link from "next/link";

export const metadata = { title: "Terms of Service — Nightshift" };

// TEMPLATE TERMS — have your counsel review and finalize before public launch.
// Bracketed items need real values.

const EFFECTIVE = "September 2, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen px-6 py-10">
      <article className="max-w-[760px] mx-auto rounded-sm bg-paper text-papertext px-10 py-10 leading-relaxed text-[15.5px] space-y-5">
        <header>
          <h1 className="font-display font-bold uppercase tracking-wide text-3xl">
            Terms of Service
          </h1>
          <p className="text-paperdim text-sm mt-1">Effective {EFFECTIVE} · Draft for counsel review</p>
        </header>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">1. The service</h2>
          <p>
            Nightshift (&ldquo;the Service&rdquo;), operated by [COMPANY LEGAL NAME]
            (&ldquo;we,&rdquo; &ldquo;us&rdquo;), is software that helps law firms
            (&ldquo;Customers&rdquo;) manage inbound client inquiries: it receives messages
            across channels the Customer connects, uses artificial intelligence to extract a
            structured summary and draft a proposed reply, and presents both to the
            Customer&apos;s staff for human review. The Service sends no communication to any
            prospective client except as explicitly approved by a person at the Customer firm.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            2. Not a law firm; no legal advice
          </h2>
          <p>
            We are not a law firm, and the Service does not provide legal advice — to
            Customers or to any person who contacts a Customer through it. AI-generated
            summaries, scores, drafts, and deadline calculations are administrative aids for
            the Customer&apos;s own professional judgment. In particular:
            statute-of-limitations information is computed from a general reference table that
            the Customer&apos;s attorney must independently verify against current law before
            enabling, and it ignores exceptions (including discovery rules, tolling, and
            notice-of-claim deadlines) that only an attorney can evaluate. The Customer is
            solely responsible for compliance with its professional-responsibility
            obligations, including advertising and solicitation rules, conflict checking, and
            deadline management.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">3. Accounts</h2>
          <p>
            You must provide accurate information, keep credentials confidential, and be
            authorized to act for the firm you register. You are responsible for activity
            under your firm&apos;s accounts. We may suspend accounts that violate these terms
            or create risk for the Service or others.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            4. Customer data and inquiries
          </h2>
          <p>
            Messages from prospective clients, extracted case files, and firm configuration
            are the Customer&apos;s data. We process them only to provide the Service,
            including transmission to the subprocessors listed in our{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>{" "}
            (AI model provider, telephony, email, payments). We claim no ownership and do not
            use Customer data to train AI models.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            5. Fees and trial
          </h2>
          <p>
            The Service starts with a free trial; continued use requires a paid subscription
            billed through Stripe. Fees are charged in advance on a recurring basis, are
            non-refundable except as required by law, and may change with at least 30
            days&apos; notice effective at your next renewal. Taxes are your responsibility.
            If payment fails, we may pause outbound sending after a grace period; your data
            remains accessible.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            6. Acceptable use
          </h2>
          <p>
            No unlawful use; no sending spam or communications that violate telemarketing,
            bar-solicitation, or consent rules; no attempts to breach tenant isolation or
            probe the Service&apos;s security; no reselling without our written agreement. The
            Customer is responsible for having any consent required to text or email the
            people who contact it.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            7. Disclaimers
          </h2>
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND,
            EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
            AND NON-INFRINGEMENT. AI OUTPUT MAY BE INCOMPLETE OR WRONG; HUMAN REVIEW IS A
            CONDITION OF USE, NOT A COURTESY. WE DO NOT WARRANT THAT THE SERVICE WILL BE
            UNINTERRUPTED OR ERROR-FREE.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            8. Limitation of liability
          </h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE FOR INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOST PROFITS OR
            REVENUES. OUR AGGREGATE LIABILITY ARISING OUT OF THE SERVICE IS LIMITED TO THE
            FEES PAID BY THE CUSTOMER IN THE TWELVE MONTHS BEFORE THE CLAIM. NOTHING HERE
            LIMITS LIABILITY THAT CANNOT BE LIMITED BY LAW.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            9. Termination
          </h2>
          <p>
            You may cancel any time from Settings → Billing; access continues through the paid
            period. Upon written request within 30 days of termination we will provide an
            export of your firm&apos;s data, after which we may delete it per our retention
            schedule.
          </p>
        </section>

        <section>
          <h2 className="font-display font-bold uppercase tracking-wide text-lg">
            10. General
          </h2>
          <p>
            These terms are governed by the laws of [STATE], excluding conflicts rules, with
            exclusive venue in [COUNTY, STATE]. We may update these terms with notice; changes
            take effect at your next renewal or 30 days after notice, whichever is later.
            Contact: [SUPPORT EMAIL].
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
