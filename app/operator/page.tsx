import { count, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/product/AppShell";
import { audit } from "@/lib/audit";
import { isOperator, requireFirmUser } from "@/lib/auth";
import { billingEnabled, firmBillingState } from "@/lib/billing";
import { getDb, tables } from "@/lib/db";
import type { FirmRow } from "@/lib/db/schema";
import { isDemo } from "@/lib/mode";

export const dynamic = "force-dynamic";

const COMP_YEARS = 100;
const GRANT_DAYS = 30;

function billingLabel(f: FirmRow): { text: string; cls: string } {
  const s = firmBillingState(f);
  if (s.kind === "free")
    return { text: "free — Stripe not configured", cls: "text-dim" };
  if (s.kind === "active") {
    return s.pastDue
      ? { text: "subscribed · payment past due", cls: "text-stamp" }
      : { text: "subscribed", cls: "text-ok" };
  }
  if (s.kind === "trialing") {
    if (s.daysLeft > 3650)
      return { text: "comped — no expiry", cls: "text-ok" };
    return {
      text: `trial · ${s.daysLeft}d left${f.trialEndsAt ? ` (ends ${f.trialEndsAt.slice(0, 10)})` : ""}`,
      cls: s.daysLeft <= 5 ? "text-meter" : "text-ok",
    };
  }
  return {
    text: "blocked — sending paused, no trial or subscription",
    cls: "text-stamp",
  };
}

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
  await db
    .update(tables.firms)
    .set({ twilioNumber: number })
    .where(eq(tables.firms.id, firmId));
  await audit("operator.twilio_number_set", {
    firmId,
    userId: user.id,
    detail: { number },
  });
  revalidatePath("/operator");
}

async function setTrial(formData: FormData): Promise<void> {
  "use server";
  const { user } = await requireFirmUser();
  if (!isOperator(user)) redirect("/");
  const firmId = Number(formData.get("firmId"));
  const action = String(formData.get("action") ?? "");

  let trialEndsAt: string | null;
  if (action === "grant") {
    trialEndsAt = new Date(Date.now() + GRANT_DAYS * 86_400_000).toISOString();
  } else if (action === "comp") {
    trialEndsAt = new Date(
      Date.now() + COMP_YEARS * 365 * 86_400_000,
    ).toISOString();
  } else if (action === "clear") {
    trialEndsAt = null;
  } else {
    redirect("/operator");
  }

  const db = await getDb();
  await db
    .update(tables.firms)
    .set({ trialEndsAt })
    .where(eq(tables.firms.id, firmId));
  await audit("operator.trial_set", {
    firmId,
    userId: user.id,
    detail: { action, trialEndsAt },
  });
  revalidatePath("/operator");
}

export default async function OperatorConsole() {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser();
  if (!isOperator(user)) redirect("/");

  const db = await getDb();
  const firms = await db
    .select()
    .from(tables.firms)
    .orderBy(desc(tables.firms.id));
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
          Every firm on the platform, with what&apos;s left to get them live.
          Set a firm&apos;s Twilio number here after provisioning it; everything
          else the firm&apos;s own admin does in their Settings (or you do
          together on the onboarding call).
        </p>

        <div className="space-y-2">
          {firms.map((f) => {
            const onboarding: string[] = [];
            if (!(partiesBy[f.id] > 0)) onboarding.push("conflict list");
            if (!f.solAcknowledgedAt) onboarding.push("SOL ack");
            if (!f.twilioNumber) onboarding.push("phone");
            if (!(usersBy[f.id] > 1)) onboarding.push("team");
            const billing = billingLabel(f);
            return (
              <div
                key={f.id}
                className="rounded-sm border border-ink-line bg-ink-raised"
              >
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto] gap-4 items-center px-4 py-3">
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
                      <span className="block text-meter">
                        needs: {onboarding.join(", ")}
                      </span>
                    ) : (
                      <span className="block text-ok">fully onboarded</span>
                    )}
                  </div>
                  <form
                    action={setTwilioNumber}
                    className="flex items-center gap-2"
                  >
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
                  <span
                    className="font-mono text-xs text-dim"
                    title="email inbound token"
                  >
                    ✉ {f.emailInboundToken.slice(0, 8)}…
                  </span>
                </div>

                {billingEnabled() && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-line px-4 py-2.5">
                    <span className="field-label text-dim">Billing</span>
                    <span className={`font-mono text-sm ${billing.cls}`}>
                      {billing.text}
                    </span>
                    <span className="flex items-center gap-2 ml-auto">
                      <form action={setTrial}>
                        <input type="hidden" name="firmId" value={f.id} />
                        <input type="hidden" name="action" value="grant" />
                        <button className="field-label text-manila hover:text-meter">
                          Grant {GRANT_DAYS}-day trial
                        </button>
                      </form>
                      <span className="text-ink-line">·</span>
                      <form action={setTrial}>
                        <input type="hidden" name="firmId" value={f.id} />
                        <input type="hidden" name="action" value="comp" />
                        <button className="field-label text-manila hover:text-meter">
                          Comp
                        </button>
                      </form>
                      <span className="text-ink-line">·</span>
                      <form action={setTrial}>
                        <input type="hidden" name="firmId" value={f.id} />
                        <input type="hidden" name="action" value="clear" />
                        <button className="field-label text-dim hover:text-stamp">
                          Clear
                        </button>
                      </form>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
