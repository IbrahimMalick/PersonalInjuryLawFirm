import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import IntakeSubmitButton from "@/components/IntakeSubmitButton";
import { blobConfigured } from "@/lib/blob";
import { getFirmBySlug } from "@/lib/firm";
import { intakeCopyFor, intakeLang } from "@/lib/intake-copy";

export const dynamic = "force-dynamic";

// Public hosted intake form, one per firm — the link a firm puts behind the
// "Contact us" button on their website. Plain HTML form, works without JS.
// Kept out of search: firms link to it directly, and indexing would leak the
// firm-slug namespace.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function IntakeForm({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sent?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const firm = await getFirmBySlug(slug);
  if (!firm) notFound();
  const { sent, lang: langParam } = await searchParams;
  const lang = intakeLang(langParam);
  const t = intakeCopyFor(firm.practiceArea, lang);
  const imm = t.immigration;
  const crim = t.criminal;

  const input =
    "w-full rounded-sm border border-papertext/25 bg-white px-3 py-2.5 text-[16px] text-papertext focus:outline focus:outline-2 focus:outline-carbon";
  const langHref = (l: "en" | "es") =>
    `/intake/${firm.slug}?lang=${l}${sent ? "&sent=1" : ""}`;

  return (
    <div className="min-h-screen bg-ink grid place-items-center px-4 py-10">
      <div className="w-full max-w-xl rounded-sm bg-paper text-papertext shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="px-8 pt-4 flex justify-end gap-2 text-[13px] font-mono">
          <Link
            href={langHref("en")}
            className={lang === "en" ? "font-bold underline" : "text-papertext/50 hover:text-papertext"}
          >
            English
          </Link>
          <span className="text-papertext/30">·</span>
          <Link
            href={langHref("es")}
            className={lang === "es" ? "font-bold underline" : "text-papertext/50 hover:text-papertext"}
          >
            Español
          </Link>
        </div>
        <div className="px-8 pt-3 pb-5 border-b-2 border-papertext/15 text-center">
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
              {t.confirmTitle}
            </div>
            <p className="mt-3 text-[16px] leading-relaxed">{t.confirmBody}</p>
            <p className="mt-4 text-sm text-paperdim">{t.emergency}</p>
          </div>
        ) : (
          <form
            method="POST"
            action={`/api/inbound/webform?redirect=1&firm=${firm.slug}&lang=${lang}`}
            encType="multipart/form-data"
            className="px-8 py-6 space-y-4"
          >
            <p className="text-[15px] leading-snug">{t.intro}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label text-paperdim">{t.firstName}</span>
                <input name="firstName" className={input} autoComplete="given-name" />
              </label>
              <label className="block">
                <span className="field-label text-paperdim">{t.lastName}</span>
                <input name="lastName" className={input} autoComplete="family-name" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label text-paperdim">{t.phone}</span>
                <input name="phone" type="tel" className={input} autoComplete="tel" />
              </label>
              <label className="block">
                <span className="field-label text-paperdim">{t.email}</span>
                <input name="email" type="email" className={input} autoComplete="email" />
              </label>
            </div>
            {crim && (
              <p
                className="rounded-sm border-2 border-stamp/60 bg-stamp/10 px-3 py-2 text-[14px] leading-snug"
                role="note"
              >
                {crim.narrativeWarning}
              </p>
            )}
            <label className="block">
              <span className="field-label text-paperdim">{t.whatHappened}</span>
              <textarea name="message" rows={crim ? 4 : 6} className={input} />
            </label>
            {crim && (
              <>
                <fieldset className="block">
                  <legend className="field-label text-paperdim">{crim.inCustodyLabel}</legend>
                  <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[16px]">
                    {(
                      [
                        ["yes", crim.inCustodyYes],
                        ["no", crim.inCustodyNo],
                        ["unsure", crim.inCustodyUnsure],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2">
                        <input type="radio" name="inCustody" value={value} />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  <span className="field-label text-paperdim">{crim.courtDateLabel}</span>
                  <input name="courtDate" type="date" className={input} />
                  <span className="block text-[13px] text-paperdim mt-1">{crim.courtDateHint}</span>
                </label>
                <label className="block">
                  <span className="field-label text-paperdim">{crim.courtLabel}</span>
                  <input name="court" className={input} />
                  <span className="block text-[13px] text-paperdim mt-1">{crim.courtHint}</span>
                </label>
              </>
            )}
            {imm && (
              <>
                <p className="text-[13px] leading-snug text-paperdim">{imm.identifierWarning}</p>
                <label className="block">
                  <span className="field-label text-paperdim">{imm.countryLabel}</span>
                  <input name="country" className={input} autoComplete="country-name" />
                </label>
                <fieldset className="block">
                  <legend className="field-label text-paperdim">{imm.detainedLabel}</legend>
                  <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[16px]">
                    {(
                      [
                        ["yes", imm.detainedYes],
                        ["no", imm.detainedNo],
                        ["unsure", imm.detainedUnsure],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2">
                        <input type="radio" name="detained" value={value} />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  <span className="field-label text-paperdim">{imm.keyDateLabel}</span>
                  <input name="keyDate" type="date" className={input} />
                  <span className="block text-[13px] text-paperdim mt-1">{imm.keyDateHint}</span>
                </label>
              </>
            )}
            {blobConfigured() && (
              <label className="block">
                <span className="field-label text-paperdim">{t.attachmentsLabel}</span>
                <input
                  type="file"
                  name="attachments"
                  multiple
                  accept="image/*,.pdf"
                  className="w-full text-[15px] text-papertext file:mr-3 file:rounded-sm file:border-0 file:bg-carbon file:text-paper file:px-3 file:py-2 file:font-display file:font-bold file:uppercase file:tracking-wide file:cursor-pointer"
                />
                <span className="block text-[13px] text-paperdim mt-1">{t.attachmentsHint}</span>
              </label>
            )}
            {/* Honeypot + render timestamp (spam defenses) */}
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] w-px h-px opacity-0"
            />
            <input type="hidden" name="_renderedAt" value={Date.now()} />
            <IntakeSubmitButton className="w-full rounded-sm bg-carbon text-paper font-display font-bold uppercase tracking-wider text-lg py-3 hover:bg-ink transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {t.submit}
            </IntakeSubmitButton>
            <p className="text-[13px] leading-snug text-paperdim">{t.disclaimer}</p>
          </form>
        )}
      </div>
    </div>
  );
}
