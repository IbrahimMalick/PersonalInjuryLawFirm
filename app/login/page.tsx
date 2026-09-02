import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { createSession, verifyPassword } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";

export const dynamic = "force-dynamic";

async function login(formData: FormData): Promise<void> {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const db = await getDb();
  const user = (
    await db.select().from(tables.users).where(eq(tables.users.email, email)).limit(1)
  )[0];

  const ok =
    user && !user.disabledAt ? await verifyPassword(password, user.passwordHash) : false;
  if (!ok || !user) {
    await audit("login.failed", { firmId: user?.firmId ?? null, detail: { email } });
    redirect("/login?error=1");
  }
  await audit("login.succeeded", { firmId: user.firmId, userId: user.id });
  await createSession(user.id);
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const input =
    "w-full rounded-sm border border-ink-line bg-ink px-3 py-2.5 text-[16px] text-inktext focus:outline focus:outline-2 focus:outline-meter";

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form
        action={login}
        className="w-full max-w-sm rounded-sm border border-ink-line bg-ink-raised px-7 py-6 space-y-4"
      >
        <div className="text-center">
          <div className="mx-auto w-10 h-10 grid place-items-center border-2 border-meter text-meter rounded-sm font-display font-bold text-lg mb-2">
            N
          </div>
          <h1 className="font-display font-bold text-xl uppercase tracking-widest text-paper">
            Nightshift
          </h1>
          <p className="field-label text-dim mt-1">Intake desk · sign in</p>
        </div>
        {error && (
          <p className="text-stamp text-sm border border-stamp/50 rounded-sm px-3 py-2">
            That email and password don&apos;t match an active account.
          </p>
        )}
        <label className="block">
          <span className="field-label text-dim">Email</span>
          <input name="email" type="email" required className={input} autoComplete="email" />
        </label>
        <label className="block">
          <span className="field-label text-dim">Password</span>
          <input
            name="password"
            type="password"
            required
            className={input}
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-lg py-2.5 hover:bg-manila-deep transition-colors"
        >
          Sign in
        </button>
        <p className="text-center text-sm text-dim">
          New firm?{" "}
          <Link href="/signup" className="text-manila underline underline-offset-4">
            Create your desk in two minutes
          </Link>
        </p>
      </form>
    </div>
  );
}
