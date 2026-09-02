import { notFound } from "next/navigation";
import { getFirmBySlug } from "@/lib/firm";

export const dynamic = "force-dynamic";

// Public hosted intake form, one per firm — the link a firm puts behind the
// "Contact us" button on their website. Plain HTML form, works without JS.

export default async function IntakeForm({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { slug } = await params;
  const firm = await getFirmBySlug(slug);
  if (!firm) notFound();
  const { sent } = await searchParams;

  const input =
    "w-full rounded-sm border border-papertext/25 bg-white px-3 py-2.5 text-[16px] text-papertext focus:outline focus:outline-2 focus:outline-carbon";

  return (
    <div className="min-h-screen bg-ink grid place-items-center px-4 py-10">
      <div className="w-full max-w-xl rounded-sm bg-paper text-papertext shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="px-8 pt-7 pb-5 border-b-2 border-papertext/15 text-center">
          <div className="mx-auto w-10 h-10 grid place-items-center border-2 border-papertext rounded-sm font-display font-bold text-lg mb-2">
            {firm.name
              .split(/\s+/)
              .map((w) => w[0])
              .slice(0, 2)
              .join("·")}
          </div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-widest">{firm.name}</h1>
          <p className="field-label text-paperdim mt-1">
            {firm.practiceLine}
            {firm.addressLine ? ` · ${firm.addressLine}` : ""}
          </p>
        </div>

        {sent ? (
          <div className="px-8 py-10 text-center">
            <div className="font-display font-bold text-2xl uppercase tracking-wide">
              We got your message
            </div>
            <p className="mt-3 text-[16px] leading-relaxed">
              A member of our team personally reviews every inquiry — day or night. If you gave
              us a phone number or email, we&apos;ll be in touch soon.
            </p>
            <p className="mt-4 text-sm text-paperdim">
              If this is a medical emergency, call 911.
            </p>
          </div>
        ) : (
          <form
            method="POST"
            action={`/api/inbound/webform?redirect=1&firm=${firm.slug}`}
            className="px-8 py-6 space-y-4"
          >
            <p className="text-[15px] leading-snug">
              Tell us what happened. It&apos;s okay if you don&apos;t have every detail — we can
              start with whatever you know.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label text-paperdim">First name</span>
                <input name="firstName" className={input} autoComplete="given-name" />
              </label>
              <label className="block">
                <span className="field-label text-paperdim">Last name</span>
                <input name="lastName" className={input} autoComplete="family-name" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label text-paperdim">Phone</span>
                <input name="phone" type="tel" className={input} autoComplete="tel" />
              </label>
              <label className="block">
                <span className="field-label text-paperdim">Email</span>
                <input name="email" type="email" className={input} autoComplete="email" />
              </label>
            </div>
            <label className="block">
              <span className="field-label text-paperdim">What happened?</span>
              <textarea name="message" rows={6} className={input} />
            </label>
            {/* Honeypot + render timestamp (spam defenses) */}
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] w-px h-px opacity-0"
            />
            <input type="hidden" name="_renderedAt" value={Date.now()} />
            <button
              type="submit"
              className="w-full rounded-sm bg-carbon text-paper font-display font-bold uppercase tracking-wider text-lg py-3 hover:bg-ink transition-colors"
            >
              Send to our intake team
            </button>
            <p className="text-[13px] leading-snug text-paperdim">
              Submitting this form does not create an attorney-client relationship, and nothing
              here is legal advice. A member of our team reviews every inquiry personally. If
              this is a medical emergency, call 911.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
