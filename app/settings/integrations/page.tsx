import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/product/AppShell";
import { audit } from "@/lib/audit";
import { requireFirmUser } from "@/lib/auth";
import {
  ADAPTERS,
  adapterFor,
  getFirmIntegrations,
  pushTestLead,
  upsertIntegration,
} from "@/lib/integrations";
import { OAUTH_SPECS, platformAppConfigured } from "@/lib/integrations/oauth";
import type { IntegrationProvider, IntegrationRow } from "@/lib/db/schema";
import { str } from "@/lib/integrations/types";

export const dynamic = "force-dynamic";

const PROVIDERS = ADAPTERS.map((a) => a.provider);

function asProvider(v: unknown): IntegrationProvider {
  const p = String(v ?? "");
  if (!PROVIDERS.includes(p as IntegrationProvider)) redirect("/settings/integrations");
  return p as IntegrationProvider;
}

async function saveConfig(formData: FormData): Promise<void> {
  "use server";
  const { user, firm } = await requireFirmUser("admin");
  const provider = asProvider(formData.get("provider"));
  const adapter = adapterFor(provider);
  const config: Record<string, unknown> = {};
  for (const field of adapter.configFields) {
    const v = String(formData.get(field.key) ?? "").trim();
    // Blank secret fields mean "keep the stored value" so edits don't wipe keys.
    if (v === "" && field.secret) continue;
    config[field.key] = v;
  }
  await upsertIntegration(firm.id, provider, { config });
  await audit("integration.configured", {
    firmId: firm.id,
    userId: user.id,
    detail: { provider, fields: Object.keys(config) },
  });
  revalidatePath("/settings/integrations");
}

async function toggleEnabled(formData: FormData): Promise<void> {
  "use server";
  const { user, firm } = await requireFirmUser("admin");
  const provider = asProvider(formData.get("provider"));
  const enabled = formData.get("enabled") === "true";
  await upsertIntegration(firm.id, provider, { enabled });
  await audit("integration.toggled", {
    firmId: firm.id,
    userId: user.id,
    detail: { provider, enabled },
  });
  revalidatePath("/settings/integrations");
}

async function sendTest(formData: FormData): Promise<void> {
  "use server";
  const { firm } = await requireFirmUser("admin");
  const provider = asProvider(formData.get("provider"));
  const rows = await getFirmIntegrations(firm.id);
  const row = rows.find((r) => r.provider === provider);
  if (!row) redirect("/settings/integrations?test=missing");
  try {
    const result = await pushTestLead(row, firm);
    redirect(`/settings/integrations?test=${result.status}&provider=${provider}`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    redirect(`/settings/integrations?test=failed&provider=${provider}`);
  }
}

function StatusChip({
  adapter,
  row,
  platformReady,
}: {
  adapter: (typeof ADAPTERS)[number];
  row: IntegrationRow | undefined;
  platformReady: boolean;
}) {
  let label = "Not configured";
  let cls = "border-ink-line text-dim";
  if (adapter.kind === "oauth" && !platformReady) {
    label = "Via onboarding call";
  } else if (adapter.kind === "inbound") {
    label = row ? "Webhook ready" : "Point CallRail at your URL";
    cls = row ? "border-ink-line text-inktext" : cls;
  } else if (row && adapter.configured(row.config)) {
    label = row.enabled ? "Connected" : "Paused";
    cls = row.enabled ? "border-meter text-meter" : "border-ink-line text-dim";
  } else if (row) {
    label = "Simulated — finish setup";
  }
  return (
    <span className={`field-label rounded-sm border px-2 py-1 ${cls}`}>{label}</span>
  );
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { user, firm } = await requireFirmUser();
  const isAdmin = user.role === "admin";
  const rows = await getFirmIntegrations(firm.id);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  const sp = await searchParams;

  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  const callrailUrl = `${base}/api/inbound/callrail?token=${firm.emailInboundToken}`;

  return (
    <AppShell user={user} firm={firm}>
      <div className="max-w-[860px] mx-auto px-6 py-8 space-y-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display font-bold uppercase tracking-wide text-2xl text-paper">
            Integrations
          </h1>
          <Link href="/settings" className="field-label text-dim hover:text-inktext">
            ← Settings
          </Link>
        </div>
        <p className="text-dim text-[15px] max-w-[70ch]">
          Every triaged lead can flow into the tools your firm already runs. An integration
          without credentials runs <span className="text-inktext">visibly simulated</span> —
          it logs what it would send and sends nothing. Syncs retry automatically and never
          hold up intake.
        </p>

        {sp.connected && (
          <p className="rounded-sm border border-meter text-meter px-4 py-3 text-sm">
            {sp.connected} connected. New leads will sync from now on.
          </p>
        )}
        {sp.error && (
          <p className="rounded-sm border border-stamp text-stamp px-4 py-3 text-sm">
            Connection problem: {sp.error}. Try again, or raise it on your onboarding call.
          </p>
        )}
        {sp.test && (
          <p className="rounded-sm border border-ink-line text-inktext px-4 py-3 text-sm">
            Test push to {sp.provider}: {sp.test}
            {sp.test === "sent" && " — check the provider for a “Nightshift Test” record."}
            {sp.test === "failed" && " — credentials rejected or provider unreachable; details below."}
          </p>
        )}

        {ADAPTERS.map((adapter) => {
          const row = byProvider.get(adapter.provider);
          const platformReady =
            adapter.kind !== "oauth" ||
            platformAppConfigured(OAUTH_SPECS[adapter.provider as "lawmatics" | "mycase"]);
          return (
            <section
              key={adapter.provider}
              className="rounded-sm border border-ink-line bg-ink-raised px-5 py-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-display font-bold uppercase tracking-wide text-lg text-paper">
                  {adapter.label}
                </h2>
                <StatusChip adapter={adapter} row={row} platformReady={platformReady} />
              </div>
              <p className="text-dim text-sm max-w-[70ch]">{adapter.blurb}</p>

              {row?.lastError && (
                <p className="text-stamp text-sm font-mono break-all">
                  Last error: {row.lastError.slice(0, 300)}
                </p>
              )}
              {row?.lastSyncAt && (
                <p className="field-label text-dim">Last activity: {row.lastSyncAt}</p>
              )}

              {adapter.provider === "callrail" && (
                <div className="text-sm text-dim space-y-1">
                  <p className="field-label text-dim">Your CallRail webhook URL (post-call)</p>
                  <p className="font-mono text-[13px] text-inktext break-all rounded-sm border border-ink-line px-3 py-2">
                    {callrailUrl}
                  </p>
                  <p>
                    CallRail → Settings → Integrations → Webhooks → paste this as the
                    post-call endpoint.
                  </p>
                </div>
              )}

              {isAdmin && adapter.kind === "oauth" ? (
                platformReady ? (
                  <div className="flex items-center gap-3">
                    <a
                      href={`/api/integrations/${adapter.provider}/connect`}
                      className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider px-4 py-2 hover:bg-manila-deep"
                    >
                      {row && adapter.configured(row.config) ? "Reconnect" : "Connect"}
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-dim">
                    Connecting {adapter.label} is set up with you on the onboarding call —
                    it needs a platform developer app on our side.
                  </p>
                )
              ) : null}

              {isAdmin && adapter.configFields.length > 0 && (
                <form action={saveConfig} className="space-y-3">
                  <input type="hidden" name="provider" value={adapter.provider} />
                  <div className="grid grid-cols-2 gap-3">
                    {adapter.configFields.map((f) => {
                      const current = row ? str(row.config, f.key) : null;
                      return (
                        <label key={f.key} className="space-y-1">
                          <span className="field-label text-dim block">
                            {f.label}
                            {f.secret && current ? " · set" : ""}
                          </span>
                          <input
                            type={f.secret ? "password" : "text"}
                            name={f.key}
                            defaultValue={f.secret ? "" : (current ?? "")}
                            placeholder={f.secret && current ? "•••••• (unchanged)" : f.placeholder}
                            className="w-full rounded-sm border border-ink-line bg-ink px-3 py-2 text-inktext text-sm"
                          />
                          {f.help && <span className="text-dim text-xs block">{f.help}</span>}
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="submit"
                    className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider px-4 py-2 hover:bg-manila-deep"
                  >
                    Save
                  </button>
                </form>
              )}
              {isAdmin && row && adapter.kind !== "inbound" && (
                <div className="flex items-center gap-3 flex-wrap">
                  <form action={sendTest}>
                    <input type="hidden" name="provider" value={adapter.provider} />
                    <button
                      type="submit"
                      className="rounded-sm border border-ink-line text-inktext field-label px-3 py-2 hover:border-manila"
                    >
                      Send test lead
                    </button>
                  </form>
                  <form action={toggleEnabled}>
                    <input type="hidden" name="provider" value={adapter.provider} />
                    <input type="hidden" name="enabled" value={row.enabled ? "false" : "true"} />
                    <button
                      type="submit"
                      className="rounded-sm border border-ink-line text-dim field-label px-3 py-2 hover:text-inktext"
                    >
                      {row.enabled ? "Pause syncing" : "Resume syncing"}
                    </button>
                  </form>
                </div>
              )}
              {!isAdmin && (
                <p className="field-label text-dim">An admin at your firm manages this.</p>
              )}
            </section>
          );
        })}

        <p className="text-dim text-sm">
          Using GoHighLevel? Point the <span className="text-inktext">Webhook</span> card at a
          GHL inbound-webhook workflow — leads arrive with the full case file for your
          pipelines. Something else you run? Ask on the onboarding call.
        </p>
      </div>
    </AppShell>
  );
}
