import crypto from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, tables } from "./db";
import { baseUrl, sendPlatformEmail } from "./email";
import type { UserRow } from "./db/schema";

// One-time tokens for email verification, password reset, and the short-lived
// handoff between "password verified" and "2FA code verified" at login.

export type TokenPurpose = "verify_email" | "reset_password" | "two_factor_challenge";

const TTL_HOURS = { verify_email: 72, reset_password: 2, two_factor_challenge: 1 / 6 } as const; // 10 minutes

export async function issueToken(userId: number, purpose: TokenPurpose): Promise<string> {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(tables.authTokens).values({
    token,
    userId,
    purpose,
    expiresAt: new Date(Date.now() + TTL_HOURS[purpose] * 3_600_000).toISOString(),
  });
  return token;
}

/** Redeem a token exactly once. Returns the user id, or null. */
export async function redeemToken(token: string, purpose: TokenPurpose): Promise<number | null> {
  const db = await getDb();
  const rows = await db
    .update(tables.authTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(
      and(
        eq(tables.authTokens.token, token),
        eq(tables.authTokens.purpose, purpose),
        isNull(tables.authTokens.usedAt),
        gt(tables.authTokens.expiresAt, new Date().toISOString())
      )
    )
    .returning({ userId: tables.authTokens.userId });
  return rows[0]?.userId ?? null;
}

/**
 * Look up a token WITHOUT consuming it — unlike email/reset links, a 2FA
 * challenge has to survive a wrong first guess, so the login page needs to
 * read who it belongs to before knowing whether to burn it. Call
 * redeemToken() separately once the code actually checks out.
 */
export async function peekToken(token: string, purpose: TokenPurpose): Promise<number | null> {
  const db = await getDb();
  const rows = await db
    .select({ userId: tables.authTokens.userId })
    .from(tables.authTokens)
    .where(
      and(
        eq(tables.authTokens.token, token),
        eq(tables.authTokens.purpose, purpose),
        isNull(tables.authTokens.usedAt),
        gt(tables.authTokens.expiresAt, new Date().toISOString())
      )
    )
    .limit(1);
  return rows[0]?.userId ?? null;
}

export async function sendVerificationEmail(user: UserRow): Promise<void> {
  const token = await issueToken(user.id, "verify_email");
  const link = `${baseUrl()}/verify?token=${token}`;
  await sendPlatformEmail(
    user.email,
    "Verify your email — Nightshift",
    `Hi ${user.name},\n\nConfirm this address to finish setting up your Nightshift account:\n\n${link}\n\nThe link is good for 72 hours. If you didn't create this account, ignore this email.`
  );
}

export async function sendPasswordResetEmail(user: UserRow): Promise<void> {
  const token = await issueToken(user.id, "reset_password");
  const link = `${baseUrl()}/reset?token=${token}`;
  await sendPlatformEmail(
    user.email,
    "Reset your password — Nightshift",
    `Hi ${user.name},\n\nReset your Nightshift password here:\n\n${link}\n\nThe link is good for 2 hours. If you didn't ask for this, ignore this email — your password is unchanged.`
  );
}
