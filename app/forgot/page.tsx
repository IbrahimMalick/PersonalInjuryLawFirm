import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sendPasswordResetEmail } from "@/lib/auth-tokens";
import { getDb, tables } from "@/lib/db";

export const dynamic = "force-dynamic";

async function requestReset(formData: FormData): Promise<void> {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.includes("@")) {
    const db = await getDb();
    const user = (
      await db.select().from(tables.users).where(eq(tables.users.email, email)).limit(1)
    )[0];
    if (user && !user.disabledAt) await sendPasswordResetEmail(user);
  }
  // Same response whether or not the account exists.
  redirect("/forgot?sent=1");
}

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  const input =
    "w-full rounded-sm border border-ink-line bg-ink px-3 py-2.5 text-[16px] text-inktext focus:outline focus:outline-2 focus:outline-meter";

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm rounded-sm border border-ink-line bg-ink-raised px-7 py-6 space-y-4">
        <h1 className="font-display font-bold text-xl uppercase tracking-widest text-paper text-center">
          Reset password
        </h1>
        {sent ? (
          <p className="text-[15px] text-dim">
            If that email has an account, a reset link is on its way. It&apos;s good for two
            hours.
          </p>
        ) : (
          <form action={requestReset} className="space-y-4">
            <label className="block">
              <span className="field-label text-dim">Email</span>
              <input name="email" type="email" required className={input} autoComplete="email" />
            </label>
            <button className="w-full rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-lg py-2.5 hover:bg-manila-deep">
              Email me a reset link
            </button>
          </form>
        )}
        <p className="text-center text-sm text-dim">
          <Link href="/login" className="text-manila underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
