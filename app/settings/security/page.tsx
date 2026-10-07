import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import AppShell from "@/components/product/AppShell";
import { audit } from "@/lib/audit";
import {
  clearNewBackupCodesCookie,
  hashPassword,
  peekNewBackupCodesCookie,
  requireFirmUser,
  setNewBackupCodesCookie,
  verifyPassword,
} from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { isDemo } from "@/lib/mode";
import {
  consumeBackupCode,
  generateBackupCodes,
  generateSecret,
  hashBackupCodes,
  provisioningUri,
  verifyTotp,
} from "@/lib/totp";

export const dynamic = "force-dynamic";

// Every firm user manages their OWN two-factor setup here — not gated to
// admins, the same way setting a lead's outcome or adding a note isn't.
// Settings (the firm-wide page) stays admin-only; a reviewer who can't get
// into /settings can still reach this.

async function changePassword(formData: FormData): Promise<void> {
  "use server";
  const { user } = await requireFirmUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword.length < 10) redirect("/settings/security?error=password");

  const db = await getDb();
  const row = (await db.select().from(tables.users).where(eq(tables.users.id, user.id)).limit(1))[0];
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    redirect("/settings/security?error=password");
  }

  await db
    .update(tables.users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(tables.users.id, user.id));
  await audit("settings.password_changed", { firmId: user.firmId, userId: user.id });
  redirect("/settings/security?passwordChanged=1");
}

async function startEnrollment(): Promise<void> {
  "use server";
  const { user } = await requireFirmUser();
  const secret = generateSecret();
  const db = await getDb();
  // Not enabled yet — totpEnabledAt only gets set once a real code comes back,
  // proving the authenticator app is actually wired up to this secret.
  await db.update(tables.users).set({ totpSecret: secret, totpEnabledAt: null }).where(eq(tables.users.id, user.id));
  await audit("settings.2fa_enrollment_started", { firmId: user.firmId, userId: user.id });
  revalidatePath("/settings/security");
}

async function cancelEnrollment(): Promise<void> {
  "use server";
  const { user } = await requireFirmUser();
  const db = await getDb();
  const row = (await db.select().from(tables.users).where(eq(tables.users.id, user.id)).limit(1))[0];
  // Only valid mid-enrollment (a secret set, but not yet confirmed). Without
  // this check, calling this same action once 2FA is already enabled would
  // turn it off with no password or code — unlike disableTwoFactor below,
  // which requires both. A stolen session cookie alone could strip 2FA.
  if (!row || row.totpEnabledAt) {
    revalidatePath("/settings/security");
    return;
  }
  await db
    .update(tables.users)
    .set({ totpSecret: null, totpEnabledAt: null })
    .where(eq(tables.users.id, user.id));
  revalidatePath("/settings/security");
}

async function confirmEnrollment(formData: FormData): Promise<void> {
  "use server";
  const { user } = await requireFirmUser();
  const code = String(formData.get("code") ?? "");
  const db = await getDb();
  const row = (await db.select().from(tables.users).where(eq(tables.users.id, user.id)).limit(1))[0];
  if (!row?.totpSecret) redirect("/settings/security");

  if (!verifyTotp(row.totpSecret, code)) {
    redirect("/settings/security?error=confirm");
  }

  const backupCodes = generateBackupCodes();
  await db
    .update(tables.users)
    .set({ totpEnabledAt: new Date().toISOString(), totpBackupCodes: await hashBackupCodes(backupCodes) })
    .where(eq(tables.users.id, user.id));
  await audit("settings.2fa_enabled", { firmId: user.firmId, userId: user.id });
  // Shown exactly once, on the very next render of this page — see
  // lib/auth.ts. The database only ever holds the bcrypt hashes above.
  await setNewBackupCodesCookie(backupCodes);
  revalidatePath("/settings/security");
}

async function dismissBackupCodes(): Promise<void> {
  "use server";
  await requireFirmUser();
  await clearNewBackupCodesCookie();
  revalidatePath("/settings/security");
}

async function disableTwoFactor(formData: FormData): Promise<void> {
  "use server";
  const { user } = await requireFirmUser();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "");
  const db = await getDb();
  const row = (await db.select().from(tables.users).where(eq(tables.users.id, user.id)).limit(1))[0];
  if (!row) redirect("/login");

  const passwordOk = await verifyPassword(password, row.passwordHash);
  const codeOk =
    passwordOk &&
    (Boolean(row.totpSecret && verifyTotp(row.totpSecret, code)) ||
      Boolean(await consumeBackupCode(row.totpBackupCodes ?? [], code)));
  if (!passwordOk || !codeOk) {
    redirect("/settings/security?error=disable");
  }

  await db
    .update(tables.users)
    .set({ totpSecret: null, totpEnabledAt: null, totpBackupCodes: null })
    .where(eq(tables.users.id, user.id));
  await audit("settings.2fa_disabled", { firmId: user.firmId, userId: user.id });
  revalidatePath("/settings/security");
}

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; passwordChanged?: string }>;
}) {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser();
  const { error, passwordChanged } = await searchParams;
  const newBackupCodes = await peekNewBackupCodesCookie();

  const card = "rounded-sm border border-ink-line bg-ink-raised px-5 py-4";
  const h2 = "font-display font-bold uppercase tracking-wide text-lg text-paper pb-2";
  const input =
    "w-full rounded-sm border border-ink-line bg-ink px-3 py-2 text-[15px] text-inktext focus:outline focus:outline-2 focus:outline-meter";

  const pending = Boolean(user.totpSecret && !user.totpEnabledAt);
  const enabled = Boolean(user.totpEnabledAt);
  const qrDataUrl = pending && user.totpSecret ? await QRCode.toDataURL(provisioningUri(user.totpSecret, `${firm.name}: ${user.email}`)) : null;
  const manualKey = pending && user.totpSecret ? user.totpSecret.match(/.{1,4}/g)?.join(" ") : null;

  return (
    <AppShell user={user} firm={firm}>
      <div className="px-6 pt-4 pb-10 max-w-[640px] mx-auto">
        <div className="flex items-center justify-between pb-3">
          <h1 className="font-display font-bold uppercase tracking-wide text-2xl text-paper">
            Account security
          </h1>
          <Link href="/settings" className="field-label text-dim hover:text-inktext">
            ← Settings
          </Link>
        </div>

        {newBackupCodes && (
          <div className="rounded-sm border-2 border-manila bg-manila/10 px-5 py-4 mb-4">
            <div className="field-label text-manila pb-1">
              Save these backup codes now — shown only this once
            </div>
            <p className="text-sm text-dim mb-3">
              Each works one time if you lose access to your authenticator app. Store them
              somewhere other than this screen.
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[15px] text-inktext bg-ink rounded-sm px-4 py-3">
              {newBackupCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <form action={dismissBackupCodes} className="mt-3">
              <button className="rounded-sm border-2 border-manila text-manila font-display font-bold uppercase tracking-wider text-sm px-4 py-2 hover:bg-manila/10">
                I&apos;ve saved these
              </button>
            </form>
          </div>
        )}

        <div className={`${card} mb-4`}>
          <h2 className={h2}>Password</h2>
          <p className="text-sm text-dim leading-snug">{user.email}</p>
          {passwordChanged === "1" && (
            <p className="field-label text-ok mt-3">Password changed.</p>
          )}
          {error === "password" && (
            <p className="text-stamp text-sm mt-2">
              Current password didn&apos;t match, or the new one is under 10 characters —
              nothing changed.
            </p>
          )}
          <form action={changePassword} className="mt-3 space-y-3">
            <label className="block">
              <span className="field-label text-dim">Current password</span>
              <input name="currentPassword" type="password" required className={input} />
            </label>
            <label className="block">
              <span className="field-label text-dim">New password (10+ characters)</span>
              <input
                name="newPassword"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={input}
              />
            </label>
            <button className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-sm px-4 py-2 hover:bg-manila-deep">
              Change password
            </button>
          </form>
        </div>

        <div className={card}>
          <h2 className={h2}>Two-factor authentication</h2>
          <p className="text-sm text-dim leading-snug">
            {user.email} · {firm.name}
          </p>

          {enabled ? (
            <>
              <p className="field-label text-ok mt-3">
                Enabled {user.totpEnabledAt ? fmtDateTime(user.totpEnabledAt, firm.timezone) : ""}
              </p>
              <p className="text-sm text-dim mt-1">
                {(user.totpBackupCodes ?? []).length} backup code
                {(user.totpBackupCodes ?? []).length === 1 ? "" : "s"} remaining.
              </p>
              {error === "disable" && (
                <p className="text-stamp text-sm mt-2">
                  Password or code didn&apos;t match — nothing changed.
                </p>
              )}
              <form action={disableTwoFactor} className="mt-4 space-y-3 border-t border-ink-line pt-4">
                <div className="field-label text-dim">Disable two-factor authentication</div>
                <label className="block">
                  <span className="field-label text-dim">Current password</span>
                  <input name="password" type="password" required className={input} />
                </label>
                <label className="block">
                  <span className="field-label text-dim">Current code or a backup code</span>
                  <input name="code" required className={input} />
                </label>
                <button className="rounded-sm border-2 border-stamp text-stamp font-display font-bold uppercase tracking-wider text-sm px-4 py-2 hover:bg-stamp/10">
                  Disable
                </button>
              </form>
            </>
          ) : pending ? (
            <>
              <p className="text-[15px] text-inktext mt-3">
                Scan this with an authenticator app (Google Authenticator, Authy, 1Password, …),
                then enter the 6-digit code it shows to finish turning this on.
              </p>
              <div className="flex flex-wrap items-start gap-5 mt-4">
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="Scan with your authenticator app" width={176} height={176} className="rounded-sm bg-paper p-2" />
                )}
                <div className="flex-1 min-w-[200px]">
                  <div className="field-label text-dim">Can&apos;t scan? Enter this key manually</div>
                  <div className="font-mono text-[15px] text-inktext mt-1 break-all">{manualKey}</div>
                </div>
              </div>
              {error === "confirm" && (
                <p className="text-stamp text-sm mt-3">That code didn&apos;t match — try again.</p>
              )}
              <form action={confirmEnrollment} className="mt-4 flex items-end gap-2">
                <label className="flex-1">
                  <span className="field-label text-dim">6-digit code</span>
                  <input name="code" inputMode="numeric" required className={input} />
                </label>
                <button className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider text-sm px-4 py-2 hover:bg-manila-deep">
                  Confirm
                </button>
              </form>
              <form action={cancelEnrollment} className="mt-2">
                <button className="field-label text-dim hover:text-stamp">Cancel setup</button>
              </form>
            </>
          ) : (
            <>
              <p className="text-[15px] text-inktext mt-3 leading-relaxed">
                Adds a second step at sign-in — a 6-digit code from your phone, on top of your
                password. Worth turning on given what this account can see.
              </p>
              <form action={startEnrollment} className="mt-3">
                <button className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider px-4 py-2 hover:bg-manila-deep">
                  Enable two-factor authentication
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
