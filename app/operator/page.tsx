import { count, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/product/AppShell";
import { audit } from "@/lib/audit";
import { isOperator, requireFirmUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { isDemo } from "@/lib/mode";

export const dynamic = "force-dynamic";

// The hand-holding surface: platform operators (OPERATOR_EMAILS allowlist)
// see every firm's onboarding state and wire up channel identities for them.
// This page is about helping firms go live — tenant lead data stays in the
// tenant's own screens.

async function setTwilioNumber(formData: FormData): Promise<void> {
  "use server";
  const { user } = await requireFirmUser();
  if (!isOperator(user)) redirect("/");
  const firmId = Number(formData.get("firmId"));
  const number = String(formData.get("number") ?? "").trim() || null;
  const db = await getDb();
  await db.update(tables.firms).set({ twilioNumber: number }).where(eq(tables.firms.id, firmId));
  await audit("operator.twilio_number_set", {
    firmId,
    userId: user.id,
    detail: { number },
  });
  revalidatePath("/operator");
}

export default async function OperatorConsole() {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser();
  if (!isOperator(user)) redirect("/");

  const db = await getDb();
  const firms = await db.select().from(tables.firms).orderBy(desc(tables.firms.id));
  const leadCounts = await db
    .select({ firmId: tables.leads.firmId, n: count() })
    .from(tables.leads)
    .groupBy(tables.leads.firmId);
  const userCounts = await db
    .select({ firmId: tables.users.firmId, n: count() })
    .from(tables.users)
    .groupBy(tables.users.firmId);
  const partyCounts = await db
    .select({ firmId: tables.adverseParties.firmId, n: count() })
    .from(tables.adverseParties)
    .groupBy(tables.adverseParties.firmId);
  const byFirm = (rows: { firmId: number; n: number }[]) =>
    Object.fromEntries(rows.map((r) => [r.firmId, r.n]));
  const leadsBy = byFirm(leadCounts);
  const usersBy = byFirm(userCounts);
  const partiesBy = byFirm(partyCounts);

  const base = process.env.PUBLIC_BASE_URL ?? "";
  const input =
    "rounded-sm border border-ink-line bg-ink px-2 py-1 text-sm font-mono text-inktext focus:outline focus:outline-2 focus:outline-meter";

  return (
    <AppShell user={user} firm={firm}>
      <div className="px-6 pt-4 pb-10 max-w-[1300px] mx-auto">
        <h1 className="font-display font-bold uppercase tracking-wide text-2xl text-paper pb-1">
          Operator console
        </h1>
        <p className="text-dim text-[15px] pb-4">
          Every firm on the platform, with what&apos;s left to get them live. Set a firm&apos;s
          Twilio number here after provisioning it; everything else the firm&apos;s own admin
          does in their Settings (or you do together on the onboarding call).
        </p>

        <div className="space-y-2">
          {firms.map((f) => {
            const onboarding: string[] = [];
            if (!(partiesBy[f.id] > 0)) onboarding.push("conflict list");
            if (!f.solAcknowledgedAt) onboarding.push("SOL ack");
            if (!f.twilioNumber) onboarding.push("phone");
            if (!(usersBy[f.id] > 1)) onboarding.push("team");
            return (
              <div
                key={f.id}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto] gap-4 items-center rounded-sm border border-ink-line bg-ink-raised px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-display font-semibold text-lg text-paper uppercase tracking-wide truncate">
                    {f.name}
                  </div>
                  <div className="font-mono text-xs text-dim truncate">
                    /{f.slug} · since {f.createdAt.slice(0, 10)} ·{" "}
                    <a
                      className="text-manila hover:underline"
                      href={`${base}/intake/${f.slug}`}
                    >
                      intake form
                    </a>
                  </div>
                </div>
                <div className="font-mono text-sm text-dim">
                  {leadsBy[f.id] ?? 0} leads · {usersBy[f.id] ?? 0} users ·{" "}
                  {partiesBy[f.id] ?? 0} conflict entries
                  {onboarding.length > 0 ? (
                    <span className="block text-meter">needs: {onboarding.join(", ")}</span>
                  ) : (
                    <span className="block text-ok">fully onboarded</span>
                  )}
                </div>
                <form action={setTwilioNumber} className="flex items-center gap-2">
                  <input type="hidden" name="firmId" value={f.id} />
                  <input
                    name="number"
                    defaultValue={f.twilioNumber ?? ""}
                    placeholder="+1718…"
                    className={input}
                    aria-label={`Twilio number for ${f.name}`}
                  />
                  <button className="field-label text-manila hover:text-meter shrink-0">
                    Set
                  </button>
                </form>
                <span className="font-mono text-xs text-dim" title="email inbound token">
                  ✉ {f.emailInboundToken.slice(0, 8)}…
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
