import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { createSession, hashPassword, isConfigured } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { updateFirm } from "@/lib/firm";

export const dynamic = "force-dynamic";

// First run: create the firm identity and the first admin account.
// Once any user exists this page permanently redirects to /login.

async function completeSetup(formData: FormData): Promise<void> {
  "use server";
  if (await isConfigured()) redirect("/login");

  const firmName = String(formData.get("firmName") ?? "").trim();
  const practiceLine = String(formData.get("practiceLine") ?? "").trim() || "Injury Law";
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!firmName || !name || !email.includes("@") || password.length < 10) {
    redirect("/setup?error=1");
  }

  await updateFirm({ name: firmName, practiceLine });
  const db = await getDb();
  const inserted = await db
    .insert(tables.users)
    .values({ email, name, passwordHash: await hashPassword(password), role: "admin" })
    .returning({ id: tables.users.id });

  await audit("setup.completed", {
    userId: inserted[0].id,
    detail: { firmName, adminEmail: email },
  });
  await createSession(inserted[0].id);
  redirect("/");
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isConfigured()) redirect("/login");
  const { error } = await searchParams;

  const input =
    "w-full rounded-sm border border-ink-line bg-ink px-3 py-2.5 text-[16px] text-inktext focus:outline focus:outline-2 focus:outline-meter";

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form
        action={completeSetup}
        className="w-full max-w-md rounded-sm border border-ink-line bg-ink-raised px-7 py-6 space-y-4"
      >
        <div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-wide text-paper">
            Set up Nightshift
          </h1>
          <p className="text-dim text-[15px] mt-1">
            This instance belongs to one firm. Create the firm identity and the first
            administrator account.
          </p>
        </div>
        {error && (
          <p className="text-stamp text-sm border border-stamp/50 rounded-sm px-3 py-2">
            Check the fields: every field is required, and the password needs at least 10
            characters.
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
            <span className="field-label text-dim">Email</span>
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
          Create firm &amp; sign in
        </button>
      </form>
    </div>
  );
}
