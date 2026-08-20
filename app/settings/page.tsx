import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/product/AppShell";
import { audit } from "@/lib/audit";
import { hashPassword, requireUser } from "@/lib/auth";
import { channelStatus } from "@/lib/channels/outbound";
import { getDb, tables } from "@/lib/db";
import { getFirm, updateFirm } from "@/lib/firm";
import { isDemo } from "@/lib/mode";

export const dynamic = "force-dynamic";

async function saveFirm(formData: FormData): Promise<void> {
  "use server";
  const user = await requireUser("admin");
  await updateFirm({
    name: String(formData.get("name") ?? "").trim() || "Your Firm",
    practiceLine: String(formData.get("practiceLine") ?? "").trim(),
    addressLine: String(formData.get("addressLine") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    timezone: String(formData.get("timezone") ?? "America/New_York").trim(),
  });
  await audit("settings.firm_updated", { userId: user.id });
  revalidatePath("/settings");
}

async function acknowledgeSol(): Promise<void> {
  "use server";
  const user = await requireUser("admin");
  await updateFirm({
    solAcknowledgedAt: new Date().toISOString(),
    solAcknowledgedBy: user.id,
  });
  await audit("settings.sol_acknowledged", { userId: user.id });
  revalidatePath("/settings");
}

async function addUser(formData: FormData): Promise<void> {
  "use server";
  const admin = await requireUser("admin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "reviewer";
  if (!email.includes("@") || !name || password.length < 10) redirect("/settings?userError=1");
  const db = await getDb();
  await db
    .insert(tables.users)
    .values({ email, name, passwordHash: await hashPassword(password), role })
    .onConflictDoNothing();
  await audit("settings.user_added", { userId: admin.id, detail: { email, role } });
  revalidatePath("/settings");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ userError?: string }>;
}) {
  if (isDemo()) redirect("/demo");
  const user = await requireUser("admin");
  const firm = await getFirm();
  const db = await getDb();
  const users = await db.select().from(tables.users);
  const channels = channelStatus();
  const { userError } = await searchParams;
  const base = process.env.PUBLIC_BASE_URL ?? "https://<your-domain>";

  const input =
    "w-full rounded-sm border border-ink-line bg-ink px-3 py-2 text-[15px] text-inktext focus:outline focus:outline-2 focus:outline-meter";
  const card = "rounded-sm border border-ink-line bg-ink-raised px-5 py-4";
  const h2 = "font-display font-bold uppercase tracking-wide text-lg text-paper pb-2";

  return (
    <AppShell user={user}>
      <div className="px-6 pt-4 pb-10 max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between pb-3">
          <h1 className="font-display font-bold uppercase tracking-wide text-2xl text-paper">
            Settings
          </h1>
          <Link href="/settings/conflicts" className="field-label text-manila hover:text-meter">
            Conflict list ▸
          </Link>
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
                Filing-deadline countdowns come from the reviewed table in{" "}
                <span className="font-mono">lib/sol-table.ts</span> plus date math — never from
                the model. The table ships as illustrative data:{" "}
                <span className="text-inktext">
                  an attorney must review it against current law and acknowledge it before
                  deadlines are shown to reviewers.
                </span>
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
                  All fields required; password 10+ characters.
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
                    <span className="field-label text-ok">LIVE</span>
                  </div>
                  <p className="font-mono text-sm text-dim mt-1 break-all">
                    Hosted at {base}/intake — link your site&apos;s &ldquo;Contact us&rdquo;
                    button to it.
                  </p>
                </div>
                <div className="border-t border-ink-line pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-inktext">Phone — SMS, voicemail &amp; WhatsApp (Twilio)</span>
                    <span className={`field-label ${channels.twilio ? "text-ok" : "text-meter"}`}>
                      {channels.twilio ? "CONFIGURED" : "SIMULATED"}
                    </span>
                  </div>
                  <p className="text-sm text-dim mt-1 leading-snug">
                    Set <span className="font-mono">TWILIO_ACCOUNT_SID</span>,{" "}
                    <span className="font-mono">TWILIO_AUTH_TOKEN</span>,{" "}
                    <span className="font-mono">TWILIO_PHONE_NUMBER</span>. Point the number&apos;s
                    webhooks at:
                  </p>
                  <p className="font-mono text-xs text-dim mt-1 break-all">
                    SMS: {base}/api/inbound/twilio/sms
                    <br />
                    Voice: {base}/api/inbound/twilio/voice
                  </p>
                </div>
                <div className="border-t border-ink-line pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-inktext">Email intake</span>
                    <span
                      className={`field-label ${process.env.EMAIL_INBOUND_TOKEN ? "text-ok" : "text-meter"}`}
                    >
                      {process.env.EMAIL_INBOUND_TOKEN ? "CONFIGURED" : "OFF"}
                    </span>
                  </div>
                  <p className="text-sm text-dim mt-1 leading-snug">
                    SendGrid Inbound Parse →{" "}
                    <span className="font-mono break-all">
                      {base}/api/inbound/email?token=&lt;EMAIL_INBOUND_TOKEN&gt;
                    </span>
                    . Outbound needs <span className="font-mono">SENDGRID_API_KEY</span> +{" "}
                    <span className="font-mono">EMAIL_FROM_ADDRESS</span>.
                  </p>
                </div>
              </div>
              <p className="text-sm text-dim mt-4 border-t border-ink-line pt-3 leading-snug">
                Unconfigured channels run in <span className="text-meter">simulated</span> mode:
                approvals work end to end and are marked &ldquo;simulated&rdquo; instead of
                pretending to deliver.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
