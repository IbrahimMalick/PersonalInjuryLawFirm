// Clio Grow — Lead Inbox API. The simplest CRM path Clio offers third-party
// intake tools: a per-account inbox token, one POST, the lead lands in the
// firm's Clio Grow Lead Inbox. (Full Clio Manage OAuth sync is a later phase.)
// Docs: docs.developers.clio.com → Clio Grow → Lead Inbox API.

import type { IntegrationRow } from "../db/schema";
import { leadIdentity, leadSummary, leadUrl } from "./common";
import type { IntegrationConfig, OutboundAdapter, SyncLeadContext, SyncResult } from "./types";
import { str } from "./types";

const REGION_HOSTS: Record<string, string> = {
  us: "https://api.clio.com",
  eu: "https://eu.api.clio.com",
  au: "https://au.api.clio.com",
  ca: "https://ca.api.clio.com",
};

export function clioGrowPayload(ctx: SyncLeadContext, inboxToken: string) {
  const id = leadIdentity(ctx);
  return {
    inbox_lead: {
      from_first: id.firstName ?? "Unknown",
      from_last: id.lastName ?? (id.firstName ? "" : "Caller"),
      from_message: leadSummary(ctx),
      from_email: id.email ?? undefined,
      from_phone: id.phone ?? undefined,
      referring_url: leadUrl(ctx.lead.id),
      from_source: "Nightshift Intake",
    },
    inbox_lead_token: inboxToken,
  };
}

export const clioGrowAdapter: OutboundAdapter = {
  provider: "clio_grow",
  label: "Clio Grow",
  kind: "token",
  blurb:
    "Every triaged lead appears in your Clio Grow Lead Inbox with the full case summary.",
  configFields: [
    {
      key: "inboxToken",
      label: "Lead Inbox token",
      secret: true,
      help: "Clio Grow → Settings → Integrations → Lead Inbox token.",
    },
    {
      key: "region",
      label: "Region (us, eu, au, ca)",
      placeholder: "us",
      help: "Leave as us unless your Clio account is hosted elsewhere.",
    },
  ],
  configured: (c: IntegrationConfig) => Boolean(str(c, "inboxToken")),

  async pushLead(integration: IntegrationRow, ctx: SyncLeadContext): Promise<SyncResult> {
    const token = str(integration.config, "inboxToken");
    if (!token) {
      console.warn(`[clio_grow] SIMULATED lead push for firm ${ctx.firm.id} — no inbox token`);
      return { status: "simulated", detail: "No Lead Inbox token configured; nothing sent." };
    }
    const host = REGION_HOSTS[str(integration.config, "region") ?? "us"] ?? REGION_HOSTS.us;
    const res = await fetch(`${host}/grow/inbox_leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clioGrowPayload(ctx, token)),
    });
    if (res.status === 201 || res.ok) {
      const body = (await res.json().catch(() => ({}))) as { id?: number | string };
      return {
        status: "sent",
        externalId: body.id != null ? String(body.id) : undefined,
        detail: "Created in the Clio Grow Lead Inbox.",
      };
    }
    const text = await res.text().catch(() => "");
    throw new Error(`Clio Grow ${res.status}: ${text.slice(0, 300)}`);
  },
};
