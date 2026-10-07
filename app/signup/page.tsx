import { eq } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { createSession, hashPassword, isOperatorEmail } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/auth-tokens";
import { billingEnabled, TRIAL_DAYS } from "@/lib/billing";
import { updateFirm } from "@/lib/firm";
import { getDb, tables } from "@/lib/db";
import { createFirm } from "@/lib/firm";
import { PRACTICE_AREA_LABEL } from "@/lib/labels";
import { rateLimited } from "@/lib/rate-limit";
import { PRACTICE_AREAS, type PracticeArea } from "@/lib/schema";

export const dynamic = "force-dynamic";

// Self-serve signup: one form creates the firm and its first admin. The
// intake form works the moment this completes; everything else is guided by
// the onboarding checklist (with us on the phone when they want hands held).

async function signup(formData: FormData): Promise<void> {
  "use server";
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (await rateLimited(`signup:${ip}`, 5, 3_600_000)) redirect("/signup?error=rate");

  const firmName = String(formData.get("firmName") ?? "").trim();
  const practiceLine = String(formData.get("practiceLine") ?? "").trim();
  const practiceAreaRaw = String(formData.get("practiceArea") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const practiceArea = (PRACTICE_AREAS as readonly string[]).includes(practiceAreaRaw)
    ? (practiceAreaRaw as PracticeArea)
    : null;
  if (!firmName || !name || !practiceArea || !email.includes("@") || password.length < 10) {
    redirect("/signup?error=fields");
  }

  const db = await getDb();
  const existing = await db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.email, email))
    .limit(1);
  if (existing[0]) redirect("/signup?error=email");
  // Same hole as Settings → Add user: a signup is itself a customer-controlled
  // form that can mint a user with any email. See lib/auth.ts isOperator().
  // Reuses the generic "email already has an account" message rather than a
  // distinct one — this form is public and unauthenticated, so confirming
  // "that address is special" to an anonymous visitor is its own small leak.
  if (isOperatorEmail(email)) redirect("/signup?error=email");

  const passwordHash = await hashPassword(password);
  // One transaction, not three bare writes: without it, a failure between
  // creating the firm and inserting its first user leaves an orphaned firm
  // with no one able to log into it or clean it up through the product.
  const { firm, adminUser } = await db.transaction(async (tx) => {
    const firm = await createFirm(firmName, practiceLine, practiceArea, tx);
    if (billingEnabled()) {
      await updateFirm(
        firm.id,
        { trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString() },
        tx
      );
    }
    const inserted = await tx
      .insert(tables.users)
      .values({ firmId: firm.id, email, name, passwordHash, role: "admin" })
      .returning();
    return { firm, adminUser: inserted[0] };
  });
  await sendVerificationEmail(adminUser);

  await audit("firm.signed_up", {
    firmId: firm.id,
    userId: adminUser.id,
    detail: { firmName, slug: firm.slug, adminEmail: email, practiceArea },
  });
  await createSession(adminUser.id);
  redirect("/?welcome=1");
}

const ERRORS: Record<string, string> = {
  fields: "Check the fields: pick a practice area, fill in every required field, and use a password of at least 10 characters.",
  email: "That email already has an account — sign in instead.",
  rate: "Too many signups from this connection. Try again in an hour, or call us and we'll set you up.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const input =
    "w-full rounded-sm border border-ink-line bg-ink px-3 py-2.5 text-[16px] text-inktext focus:outline focus:outline-2 focus:outline-meter";

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center pb-5">
          <div className="mx-auto w-11 h-11 grid place-items-center border-2 border-meter text-meter rounded-sm font-display font-bold text-xl mb-2">
            N
          </div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-widest text-paper">
            Nightshift
          </h1>
          <p className="text-dim text-[15px] mt-1">
            The intake desk that doesn&apos;t sleep. Your firm&apos;s web intake works the
            moment you finish this form.
          </p>
        </div>
        <form
          action={signup}
          className="rounded-sm border border-ink-line bg-ink-raised px-7 py-6 space-y-4"
        >
          {error && (
            <p className="text-stamp text-sm border border-stamp/50 rounded-sm px-3 py-2">
              {ERRORS[error] ?? ERRORS.fields}
            </p>
          )}
          <label className="block">
            <span className="field-label text-dim">Firm name</span>
            <input name="firmName" required className={input} placeholder="Your firm's name" />
          </label>
          <label className="block">
            <span className="field-label text-dim">Practice area</span>
            <select name="practiceArea" required defaultValue="" className={input}>
              <option value="" disabled>
                Choose your practice area…
              </option>
              {PRACTICE_AREAS.map((a) => (
                <option key={a} value={a}>
                  {PRACTICE_AREA_LABEL[a]}
                </option>
              ))}
            </select>
            <span className="block text-[13px] text-dim mt-1">
              Chosen once, at signup — it sets how your intake desk reads and replies. To change
              it later, contact us.
            </span>
          </label>
          <label className="block">
            <span className="field-label text-dim">Practice line (optional)</span>
            <input
              name="practiceLine"
              className={input}
              placeholder="Shown on letterhead — defaults from your practice area"
            />
          </label>
          <div className="border-t border-ink-line pt-4 space-y-4">
            <label className="block">
              <span className="field-label text-dim">Your name</span>
              <input name="name" required className={input} autoComplete="name" />
            </label>
            <label className="block">
              <span className="field-label text-dim">Work email</span>
              <input name="email" type="email" required className={input} autoComplete="email" />
            </label>
            <label className="block">
              <span className="field-label text-dim">Password (10+ characters)</span>
              <input
                name="password"
                type="password"
                required
                minLength={10}
                className={input}
                autoComplete="new-password"
              />
            </label>
          </div>
          <button
            type="submit"
            className="w-full rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-lg py-2.5 hover:bg-manila-deep transition-colors"
          >
            Create your firm&apos;s desk
          </button>
          <p className="text-center text-[13px] text-dim leading-snug">
            By creating an account you agree to the{" "}
            <Link href="/terms" className="underline underline-offset-4">Terms of Service</Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.
          </p>
          <p className="text-center text-sm text-dim">
            Already set up?{" "}
            <Link href="/login" className="text-manila underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
