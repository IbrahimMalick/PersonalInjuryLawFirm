import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { redeemToken } from "@/lib/auth-tokens";
import { hashPassword } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";

export const dynamic = "force-dynamic";

async function resetPassword(formData: FormData): Promise<void> {
  "use server";
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) redirect(`/reset?token=${encodeURIComponent(token)}&error=short`);

  const userId = await redeemToken(token, "reset_password");
  if (!userId) redirect("/forgot?sent=0");

  const db = await getDb();
  const rows = await db
    .update(tables.users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(tables.users.id, userId))
    .returning({ firmId: tables.users.firmId });
  // Revoke every existing session for the account.
  await db.delete(tables.sessions).where(eq(tables.sessions.userId, userId));
  await audit("user.password_reset", { firmId: rows[0]?.firmId, userId });
  redirect("/login?reset=1");
}

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  if (!token) redirect("/forgot");
  const input =
    "w-full rounded-sm border border-ink-line bg-ink px-3 py-2.5 text-[16px] text-inktext focus:outline focus:outline-2 focus:outline-meter";

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form
        action={resetPassword}
        className="w-full max-w-sm rounded-sm border border-ink-line bg-ink-raised px-7 py-6 space-y-4"
      >
        <h1 className="font-display font-bold text-xl uppercase tracking-widest text-paper text-center">
          Choose a new password
        </h1>
        {error && (
          <p className="text-stamp text-sm border border-stamp/50 rounded-sm px-3 py-2">
            Password needs at least 10 characters.
          </p>
        )}
        <input type="hidden" name="token" value={token} />
        <label className="block">
          <span className="field-label text-dim">New password (10+ characters)</span>
          <input
            name="password"
            type="password"
            required
            minLength={10}
            className={input}
            autoComplete="new-password"
          />
        </label>
        <button className="w-full rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-lg py-2.5 hover:bg-manila-deep">
          Set password &amp; sign in again
        </button>
        <p className="text-center text-sm text-dim">
          <Link href="/login" className="text-manila underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
