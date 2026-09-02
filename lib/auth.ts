import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, tables } from "./db";
import type { UserRow } from "./db/schema";

const SESSION_COOKIE = "ns_session";
const SESSION_DAYS = 30;

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

/** Route-handler guard: returns null instead of redirecting. */
export async function apiUser(role?: "admin"): Promise<UserRow | null> {
  const user = await currentUser();
  if (!user) return null;
  if (role === "admin" && user.role !== "admin") return null;
  return user;
}
