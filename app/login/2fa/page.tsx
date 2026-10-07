import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import {
  clearTwoFactorChallengeCookie,
  createSession,
  getTwoFactorChallengeCookie,
  setTwoFactorChallengeCookie,
} from "@/lib/auth";
import { peekToken, redeemToken } from "@/lib/auth-tokens";
import { getDb, tables } from "@/lib/db";
import { rateLimited } from "@/lib/rate-limit";
import { consumeBackupCode, verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";

// The second step of login for an account with 2FA enabled. Reached only via
// the challenge cookie app/login/page.tsx sets after the password checks
// out — there is still no session at this point, so this page is otherwise
// unreachable and un-skippable.

async function verifyCode(formData: FormData): Promise<void> {
  "use server";
  const challenge = await getTwoFactorChallengeCookie();
  const code = String(formData.get("code") ?? "").trim();
  if (!challenge) redirect("/login");

  const userId = await peekToken(challenge, "two_factor_challenge");
  if (!userId) {
    // Expired or already used — the password step has to happen again.
    await clearTwoFactorChallengeCookie();
    redirect("/login?error=2fa_expired");
  }

  const db = await getDb();
  const user = (await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1))[0];
  if (!user || !user.totpSecret || !user.totpEnabledAt) {
    await clearTwoFactorChallengeCookie();
    redirect("/login");
  }

  // Scoped by userId, not the (single-use-ish) challenge token: a fresh
  // password check issues a fresh challenge, so limiting by token alone
  // would let an attacker just restart the password step to reset their
  // guess budget. A 6-digit code is ~1M combinations — unlimited guessing
  // made that fully parallelisable; this makes brute-forcing infeasible
  // without touching how a slow, honest typist re-tries their own code.
  if (await rateLimited(`2fa-code:${userId}`, 10, 3_600_000)) {
    await audit("login.2fa_rate_limited", { firmId: user.firmId, userId: user.id });
    redirect("/login/2fa?error=rate");
  }

  if (verifyTotp(user.totpSecret, code)) {
    await redeemToken(challenge, "two_factor_challenge");
    await clearTwoFactorChallengeCookie();
    await audit("login.succeeded", { firmId: user.firmId, userId: user.id });
    await createSession(user.id);
    redirect("/");
  }

  const remaining = await consumeBackupCode(user.totpBackupCodes ?? [], code);
  if (remaining) {
    await db.update(tables.users).set({ totpBackupCodes: remaining }).where(eq(tables.users.id, user.id));
    await redeemToken(challenge, "two_factor_challenge");
    await clearTwoFactorChallengeCookie();
    await audit("login.2fa_backup_used", {
      firmId: user.firmId,
      userId: user.id,
      detail: { codesRemaining: remaining.length },
    });
    await createSession(user.id);
    redirect("/");
  }

  // Wrong code: the challenge survives (re-issued with a fresh TTL so a slow
  // typist doesn't get punished for it) so the real device can be tried again
  // without restarting the password step.
  await audit("login.2fa_failed", { firmId: user.firmId, userId: user.id });
  await setTwoFactorChallengeCookie(challenge);
  redirect("/login/2fa?error=1");
}

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const challenge = await getTwoFactorChallengeCookie();
  if (!challenge) redirect("/login");
  const userId = await peekToken(challenge, "two_factor_challenge");
  if (!userId) redirect("/login?error=2fa_expired");
  const { error } = await searchParams;

  const input =
    "w-full rounded-sm border border-ink-line bg-ink px-3 py-2.5 text-[16px] text-inktext text-center tracking-[0.3em] font-mono focus:outline focus:outline-2 focus:outline-meter";

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form
        action={verifyCode}
        className="w-full max-w-sm rounded-sm border border-ink-line bg-ink-raised px-7 py-6 space-y-4"
      >
        <div className="text-center">
          <div className="mx-auto w-10 h-10 grid place-items-center border-2 border-meter text-meter rounded-sm font-display font-bold text-lg mb-2">
            N
          </div>
          <h1 className="font-display font-bold text-xl uppercase tracking-widest text-paper">
            Two-factor code
          </h1>
          <p className="field-label text-dim mt-1">From your authenticator app</p>
        </div>
        {error === "rate" ? (
          <p className="text-stamp text-sm border border-stamp/50 rounded-sm px-3 py-2">
            Too many attempts — try again in an hour, or sign in again to start over.
          </p>
        ) : (
          error && (
            <p className="text-stamp text-sm border border-stamp/50 rounded-sm px-3 py-2">
              That code didn&apos;t match — try again, or use a backup code.
            </p>
          )
        )}
        <label className="block">
          <span className="field-label text-dim">6-digit code or backup code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            className={input}
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-lg py-2.5 hover:bg-manila-deep transition-colors"
        >
          Verify
        </button>
        <p className="text-center text-sm text-dim">
          <Link href="/login" className="text-dim underline underline-offset-4 hover:text-manila">
            Start over
          </Link>
        </p>
      </form>
    </div>
  );
}
