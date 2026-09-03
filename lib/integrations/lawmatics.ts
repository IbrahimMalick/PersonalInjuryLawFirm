// Lawmatics — OAuth2 (authorization code). The platform's developer app must be
// enabled by Lawmatics (support@lawmatics.com) and its client id/secret set in
// LAWMATICS_CLIENT_ID / LAWMATICS_CLIENT_SECRET. Each firm then connects with
// one click and every triaged lead is created as a prospect.
// Docs: docs.lawmatics.com (OAuth API; POST /v1/prospects).

import type { IntegrationRow } from "../db/schema";
import { leadIdentity, leadSummary } from "./common";
import { hasTokens, liveAccessToken, OAUTH_SPECS, platformAppConfigured } from "./oauth";
import type { OutboundAdapter, SyncLeadContext, SyncResult } from "./types";

const API = "https://api.lawmatics.com/v1";

export function lawmaticsProspectPayload(ctx: SyncLeadContext) {
  const id = leadIdentity(ctx);
  return {
    first_name: id.firstName ?? "Unknown",
    last_name: id.lastName ?? (id.firstName ? "" : "Caller"),
    email: id.email ?? undefined,
    phone: id.phone ?? undefined,
    case_details: leadSummary(ctx),
    source: "Nightshift Intake",
  };
}

export const lawmaticsAdapter: OutboundAdapter = {
  provider: "lawmatics",
  label: "Lawmatics",
  kind: "oauth",
  blurb:
    "Each triaged lead becomes a Lawmatics prospect with the case summary in the matter details.",
  configFields: [],
  configured: (c) => hasTokens(c),

  async pushLead(integration: IntegrationRow, ctx: SyncLeadContext): Promise<SyncResult> {
    const spec = OAUTH_SPECS.lawmatics;
    if (!platformAppConfigured(spec) || !hasTokens(integration.config)) {
      console.warn(`[lawmatics] SIMULATED lead push for firm ${ctx.firm.id} — not connected`);
      return { status: "simulated", detail: "Lawmatics is not connected; nothing sent." };
    }
    const token = await liveAccessToken(spec, integration);
    const res = await fetch(`${API}/prospects`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(lawmaticsProspectPayload(ctx)),
    });
    if (!res.ok) {
      throw new Error(`Lawmatics ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const body = (await res.json().catch(() => ({}))) as { data?: { id?: string | number } };
    return {
      status: "sent",
      externalId: body.data?.id != null ? String(body.data.id) : undefined,
      detail: "Prospect created in Lawmatics.",
    };
  },
};
