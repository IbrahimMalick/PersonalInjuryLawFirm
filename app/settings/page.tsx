import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/product/AppShell";
import { audit } from "@/lib/audit";
import { hashPassword, requireFirmUser } from "@/lib/auth";
import { channelStatus } from "@/lib/channels/outbound";
import { getDb, tables } from "@/lib/db";
import { updateFirm } from "@/lib/firm";
import { isDemo } from "@/lib/mode";

export const dynamic = "force-dynamic";

async function saveFirm(formData: FormData): Promise<void> {
  "use server";
  const { user, firm } = await requireFirmUser("admin");
  await updateFirm(firm.id, {
    name: String(formData.get("name") ?? "").trim() || firm.name,
    practiceLine: String(formData.get("practiceLine") ?? "").trim(),
    addressLine: String(formData.get("addressLine") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    timezone: String(formData.get("timezone") ?? "America/New_York").trim(),
  });
  await audit("settings.firm_updated", { firmId: firm.id, userId: user.id });
  revalidatePath("/settings");
}

async function acknowledgeSol(): Promise<void> {
  "use server";
  const { user, firm } = await requireFirmUser("admin");
  await updateFirm(firm.id, {
    solAcknowledgedAt: new Date().toISOString(),
    solAcknowledgedBy: user.id,
  });
  await audit("settings.sol_acknowledged", { firmId: firm.id, userId: user.id });
  revalidatePath("/settings");
}

async function addUser(formData: FormData): Promise<void> {
  "use server";
  const { user: admin, firm } = await requireFirmUser("admin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "reviewer";
  if (!email.includes("@") || !name || password.length < 10) redirect("/settings?userError=1");
  const db = await getDb();
  const existing = await db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.email, email))
    .limit(1);
  if (existing[0]) redirect("/settings?userError=2");
  await db
    .insert(tables.users)
    .values({ firmId: firm.id, email, name, passwordHash: await hashPassword(password), role });
  await audit("settings.user_added", { firmId: firm.id, userId: admin.id, detail: { email, role } });
  revalidatePath("/settings");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ userError?: string }>;
}) {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser("admin");
  const db = await getDb();
  const users = await db.select().from(tables.users).where(eq(tables.users.firmId, firm.id));
  const channels = channelStatus(firm);
  const { userError } = await searchParams;
  const base = process.env.PUBLIC_BASE_URL ?? "https://<your-domain>";

  const input =
    "w-full rounded-sm border border-ink-line bg-ink px-3 py-2 text-[15px] text-inktext focus:outline focus:outline-2 focus:outline-meter";
  const card = "rounded-sm border border-ink-line bg-ink-raised px-5 py-4";
  const h2 = "font-display font-bold uppercase tracking-wide text-lg text-paper pb-2";

  return (
    <AppShell user={user} firm={firm}>
      <div className="px-6 pt-4 pb-10 max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between pb-3">
          <h1 className="font-display font-bold uppercase tracking-wide text-2xl text-paper">
            Settings
          </h1>
          <span className="flex gap-5">
            <Link href="/settings/billing" className="field-label text-manila hover:text-meter">
              Billing ▸
            </Link>
            <Link href="/settings/conflicts" className="field-label text-manila hover:text-meter">
              Conflict list ▸
            </Link>
            <Link href="/settings/integrations" className="field-label text-manila hover:text-meter">
              Integrations ▸
            </Link>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            {/* Firm identity */}
            <form action={saveFirm} className={card}>
              <h2 className={h2}>Firm identity</h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="field-label text-dim">Firm name</span>
                  <input name="name" defaultValue={firm.name} className={input} />
                </label>
                <label className="block">
                  <span className="field-label text-dim">Practice line</span>
                  <input name="practiceLine" defaultValue={firm.practiceLine} className={input} />
                </label>
                <label className="block">
                  <span className="field-label text-dim">Address (letterhead)</span>
                  <input name="addressLine" defaultValue={firm.addressLine} className={input} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="field-label text-dim">Phone</span>
                    <input name="phone" defaultValue={firm.phone} className={input} />
                  </label>
                  <label className="block">
                    <span className="field-label text-dim">Timezone (IANA)</span>
                    <input name="timezone" defaultValue={firm.timezone} className={input} />
                  </label>
                </div>
                <button className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider px-4 py-2 hover:bg-manila-deep">
                  Save
                </button>
              </div>
            </form>

            {/* SOL acknowledgment */}
            <div className={card}>
              <h2 className={h2}>Deadline table</h2>
              <p className="text-sm text-dim leading-snug">
                Filing-deadline countdowns come from a reviewed table plus date math — never
                from the model. The table ships as illustrative data:{" "}
                <span className="text-inktext">
                  an attorney at your firm must review it against current law and acknowledge
                  it before deadlines are shown to reviewers.
                </span>{" "}
                Ask us for the current table during onboarding — we&apos;ll walk it together.
              </p>
              {firm.solAcknowledgedAt ? (
                <p className="field-label text-ok mt-3">
                  Acknowledged {firm.solAcknowledgedAt.slice(0, 10)} by user #
                  {firm.solAcknowledgedBy}
                </p>
              ) : (
                <form action={acknowledgeSol} className="mt-3">
                  <button className="rounded-sm border-2 border-stamp text-stamp font-display font-bold uppercase tracking-wider px-4 py-2 hover:bg-stamp/10">
                    I reviewed the table — show deadlines
                  </button>
                </form>
              )}
            </div>

            {/* Users */}
            <div className={card}>
              <h2 className={h2}>Users</h2>
              <div className="font-mono text-sm space-y-1 pb-3">
                {users.map((u) => (
                  <div key={u.id} className="flex justify-between">
                    <span>
                      {u.name} · {u.email}
                    </span>
                    <span className="text-dim">{u.role}</span>
                  </div>
                ))}
              </div>
              {userError && (
                <p className="text-stamp text-sm pb-2">
                  {userError === "2"
                    ? "That email already has an account."
                    : "All fields required; password 10+ characters."}
                </p>
              )}
              <form action={addUser} className="grid grid-cols-2 gap-2">
                <input name="name" placeholder="Name" className={input} />
                <input name="email" type="email" placeholder="Email" className={input} />
                <input
                  name="password"
                  type="password"
                  placeholder="Temp password (10+)"
                  className={input}
                />
                <select name="role" className={input} defaultValue="reviewer">
                  <option value="reviewer">Reviewer</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="col-span-2 rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider px-4 py-2 hover:bg-manila-deep">
                  Add user
                </button>
              </form>
            </div>
          </div>

          {/* Channels */}
          <div className="space-y-4">
            <div className={card}>
              <h2 className={h2}>Channels</h2>
              <div className="space-y-4 text-[15px]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-inktext">Website intake form</span>
                    <span className="field-label text-ok">LIVE NOW</span>
                  </div>
                  <p className="font-mono text-sm text-dim mt-1 break-all">
                    {base}/intake/{firm.slug}
                  </p>
                  <p className="text-sm text-dim mt-1">
                    Link your site&apos;s &ldquo;Contact us&rdquo; button to it — works today,
                    nothing to configure.
                  </p>
                </div>
                <div className="border-t border-ink-line pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-inktext">
                      Phone — SMS, voicemail &amp; WhatsApp
                    </span>
                    <span className={`field-label ${channels.twilioNumber ? "text-ok" : "text-meter"}`}>
                      {channels.twilioNumber ? `LIVE · ${channels.twilioNumber}` : "NOT YET SET UP"}
                    </span>
                  </div>
                  <p className="text-sm text-dim mt-1 leading-snug">
                    {channels.twilioNumber
                      ? "Calls to this number are answered, recorded, transcribed, and triaged. Forward your office line to it after hours, or publish it directly."
                      : "We provision a dedicated intake number for your firm during onboarding — book your setup call and we'll have it live the same day."}
                  </p>
                </div>
                <div className="border-t border-ink-line pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-inktext">Email intake</span>
                    <span className={`field-label ${channels.email ? "text-ok" : "text-meter"}`}>
                      {channels.email ? "AVAILABLE" : "NOT YET SET UP"}
                    </span>
                  </div>
                  <p className="text-sm text-dim mt-1 leading-snug">
                    Forward your intake mailbox to the address we give you at onboarding —
                    it&apos;s tied to this private token:
                  </p>
                  <p className="font-mono text-xs text-dim mt-1 break-all">
                    …/api/inbound/email?token={firm.emailInboundToken.slice(0, 8)}…
                  </p>
                </div>
              </div>
              <p className="text-sm text-dim mt-4 border-t border-ink-line pt-3 leading-snug">
                Channels that aren&apos;t wired yet run in{" "}
                <span className="text-meter">simulated</span> mode: approvals work end to end
                and are marked &ldquo;simulated&rdquo; instead of pretending to deliver.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
