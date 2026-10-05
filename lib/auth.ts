import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, tables } from "./db";
import type { UserRow } from "./db/schema";

const SESSION_COOKIE = "ns_session";
const SESSION_DAYS = 30;
const TWOFA_CHALLENGE_COOKIE = "ns_2fa_challenge";
const TWOFA_CHALLENGE_MINUTES = 10; // matches the two_factor_challenge token's own TTL
const NEW_BACKUP_CODES_COOKIE = "ns_2fa_new_codes";

function cookieOpts(maxAgeSeconds: number, path = "/"): Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2] {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    maxAge: maxAgeSeconds,
    path,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export async function createSession(userId: number): Promise<void> {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(tables.sessions).values({
    token,
    userId,
    expiresAt: isoInDays(SESSION_DAYS),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    maxAge: SESSION_DAYS * 86_400,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(tables.sessions).where(eq(tables.sessions.token, token));
  }
  jar.delete(SESSION_COOKIE);
}

// ── Two-factor login handoff ─────────────────────────────────────────────────
// Between "password checked out" and "code checked out" there is no session
// yet — just this short-lived cookie naming the pending auth_tokens challenge
// (lib/auth-tokens.ts). Separate cookie from the real session on purpose: a
// half-finished login should never look like one to currentUser().

export async function setTwoFactorChallengeCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(TWOFA_CHALLENGE_COOKIE, token, cookieOpts(TWOFA_CHALLENGE_MINUTES * 60));
}

export async function getTwoFactorChallengeCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(TWOFA_CHALLENGE_COOKIE)?.value ?? null;
}

export async function clearTwoFactorChallengeCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(TWOFA_CHALLENGE_COOKIE);
}

// ── Backup codes, shown exactly once ─────────────────────────────────────────
// Only the plaintext ever touches this cookie, right after enrollment — the
// database only ever stores the bcrypt hashes. A short self-expiry is just
// hygiene on top of the explicit dismiss button on /settings/security.

export async function setNewBackupCodesCookie(codes: string[]): Promise<void> {
  const jar = await cookies();
  // Default path ("/"), matching every other cookie here — deleting a cookie
  // set on a narrower path requires repeating that exact path, and getting
  // that wrong silently leaves the old cookie in place (found by testing
  // this: the "shown once" banner kept reappearing after being dismissed).
  jar.set(NEW_BACKUP_CODES_COOKIE, codes.join(","), cookieOpts(300));
}

export async function peekNewBackupCodesCookie(): Promise<string[] | null> {
  const jar = await cookies();
  const raw = jar.get(NEW_BACKUP_CODES_COOKIE)?.value;
  return raw ? raw.split(",") : null;
}

export async function clearNewBackupCodesCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(NEW_BACKUP_CODES_COOKIE);
}

export async function currentUser(): Promise<UserRow | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({ user: tables.users })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.sessions.userId, tables.users.id))
    .where(
      and(
        eq(tables.sessions.token, token),
        gt(tables.sessions.expiresAt, new Date().toISOString()),
        isNull(tables.users.disabledAt)
      )
    )
    .limit(1);
  return rows[0]?.user ?? null;
}

/** Page guard: redirects to /login as needed. */
export async function requireUser(role?: "admin"): Promise<UserRow> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (role === "admin" && user.role !== "admin") redirect("/");
  return user;
}

/** Page guard that also loads the user's firm — the common multi-tenant path. */
export async function requireFirmUser(
  role?: "admin"
): Promise<{ user: UserRow; firm: import("./db/schema").FirmRow }> {
  const user = await requireUser(role);
  const db = await getDb();
  const firm = (
    await db.select().from(tables.firms).where(eq(tables.firms.id, user.firmId)).limit(1)
  )[0];
  if (!firm) redirect("/login"); // orphaned account — shouldn't happen
  return { user, firm };
}

/**
 * Platform operators (us): normal accounts whose email is allowlisted in
 * OPERATOR_EMAILS. Gates the /operator console used for onboarding firms.
 */
export function isOperator(user: UserRow): boolean {
  const list = (process.env.OPERATOR_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(user.email.toLowerCase());
}

/**
 * Marketing dashboard viewers: normal accounts whose email is allowlisted in
 * MARKETING_EMAILS, plus operators (who already see everything). This is
 * deliberately NOT the per-firm `role` column — that column belongs to a
 * tenant's own staff (every paying firm has an "admin"), and the marketing
 * dashboard shows cross-firm business metrics that no tenant should see.
 */
export function isMarketingViewer(user: UserRow): boolean {
  if (isOperator(user)) return true;
  const list = (process.env.MARKETING_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(user.email.toLowerCase());
}

/** Route-handler guard: returns null instead of redirecting. */
export async function apiUser(role?: "admin"): Promise<UserRow | null> {
  const user = await currentUser();
  if (!user) return null;
  if (role === "admin" && user.role !== "admin") return null;
  return user;
}
