import { eq } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { createSession, hashPassword } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/auth-tokens";
import { billingEnabled, TRIAL_DAYS } from "@/lib/billing";
import { updateFirm } from "@/lib/firm";
import { getDb, tables } from "@/lib/db";
import { createFirm } from "@/lib/firm";

export const dynamic = "force-dynamic";

// Self-serve signup: one form creates the firm and its first admin. The
// intake form works the moment this completes; everything else is guided by
// the onboarding checklist (with us on the phone when they want hands held).

const attempts = new Map<string, { count: number; windowStart: number }>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.windowStart > 3_600_000) {
    attempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > 5;
}

async function signup(formData: FormData): Promise<void> {
  "use server";
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (throttled(ip)) redirect("/signup?error=rate");

  const firmName = String(formData.get("firmName") ?? "").trim();
  const practiceLine = String(formData.get("practiceLine") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!firmName || !name || !email.includes("@") || password.length < 10) {
    redirect("/signup?error=fields");
  }

  const db = await getDb();
  const existing = await db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.email, email))
    .limit(1);
  if (existing[0]) redirect("/signup?error=email");

  const firm = await createFirm(firmName, practiceLine);
  if (billingEnabled()) {
    await updateFirm(firm.id, {
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString(),
    });
  }
  const inserted = await db
    .insert(tables.users)
    .values({
      firmId: firm.id,
      email,
      name,
      passwordHash: await hashPassword(password),
      role: "admin",
    })
    .returning();
  await sendVerificationEmail(inserted[0]);

  await audit("firm.signed_up", {
    firmId: firm.id,
    userId: inserted[0].id,
    detail: { firmName, slug: firm.slug, adminEmail: email },
  });
  await createSession(inserted[0].id);
  redirect("/?welcome=1");
}

const ERRORS: Record<string, string> = {
  fields: "Check the fields: every field is required, and the password needs at least 10 characters.",
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
            <input name="firmName" required className={input} placeholder="Reyes & Cole" />
          </label>
          <label className="block">
            <span className="field-label text-dim">Practice line</span>
            <input name="practiceLine" className={input} placeholder="Injury Law" />
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
