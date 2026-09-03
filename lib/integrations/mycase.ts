// MyCase — OAuth2 (authorization code), beta. Requires the platform's MyCase
// developer app (MYCASE_CLIENT_ID / MYCASE_CLIENT_SECRET). Each firm connects
// with one click; triaged leads are created as MyCase leads.
// Docs: mycaseapi.stoplight.io. The API base is configurable because MyCase has
// moved hosts; default is their external-integrations gateway.

import type { IntegrationRow } from "../db/schema";
import { leadIdentity, leadSummary } from "./common";
import { hasTokens, liveAccessToken, OAUTH_SPECS, platformAppConfigured } from "./oauth";
import type { OutboundAdapter, SyncLeadContext, SyncResult } from "./types";
import { str } from "./types";

const DEFAULT_API = "https://external-integrations.mycase.com/v1";

export function mycaseLeadPayload(ctx: SyncLeadContext) {
  const id = leadIdentity(ctx);
  return {
    first_name: id.firstName ?? "Unknown",
    last_name: id.lastName ?? (id.firstName ? "" : "Caller"),
    email: id.email ?? undefined,
    cell_phone: id.phone ?? undefined,
    description: leadSummary(ctx),
  };
}

export const mycaseAdapter: OutboundAdapter = {
  provider: "mycase",
  label: "MyCase",
  kind: "oauth",
  blurb:
    "Each triaged lead is created as a MyCase lead with the case summary. Beta — verify the first sync on the onboarding call.",
  configFields: [
    {
      key: "apiBase",
      label: "API base URL (leave default)",
      placeholder: DEFAULT_API,
      help: "Only change if MyCase support gives your firm a different API host.",
    },
  ],
  configured: (c) => hasTokens(c),

  async pushLead(integration: IntegrationRow, ctx: SyncLeadContext): Promise<SyncResult> {
    const spec = OAUTH_SPECS.mycase;
    if (!platformAppConfigured(spec) || !hasTokens(integration.config)) {
      console.warn(`[mycase] SIMULATED lead push for firm ${ctx.firm.id} — not connected`);
      return { status: "simulated", detail: "MyCase is not connected; nothing sent." };
    }
    const token = await liveAccessToken(spec, integration);
    const base = (str(integration.config, "apiBase") ?? DEFAULT_API).replace(/\/$/, "");
    const res = await fetch(`${base}/leads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(mycaseLeadPayload(ctx)),
    });
    if (!res.ok) {
      throw new Error(`MyCase ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string | number };
    return {
      status: "sent",
      externalId: body.id != null ? String(body.id) : undefined,
      detail: "Lead created in MyCase.",
    };
  },
};
