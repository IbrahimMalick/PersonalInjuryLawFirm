// Generic outbound webhook — the universal adapter. Point it at a GoHighLevel
// inbound-webhook workflow, a Zapier/Make hook, or your own endpoint, and every
// triaged lead arrives as signed JSON. This is also the fallback for any CRM we
// don't have a first-class adapter for yet.

import { createHmac } from "crypto";
import type { IntegrationRow } from "../db/schema";
import { leadIdentity, leadSummary, leadUrl } from "./common";
import type { IntegrationConfig, OutboundAdapter, SyncLeadContext, SyncResult } from "./types";
import { str } from "./types";

export function webhookPayload(ctx: SyncLeadContext) {
  const id = leadIdentity(ctx);
  return {
    event: ctx.caseFile ? "lead.triaged" : "lead.needs_attention",
    sentAt: new Date().toISOString(),
    firm: { id: ctx.firm.id, name: ctx.firm.name, slug: ctx.firm.slug },
    lead: {
      id: ctx.lead.id,
      channel: ctx.lead.channel,
      receivedAt: ctx.lead.receivedAt,
      status: ctx.lead.status,
      from: ctx.lead.fromAddress,
      name: id.fullName,
      email: id.email,
      phone: id.phone,
      raw: ctx.lead.raw,
      reviewUrl: leadUrl(ctx.lead.id),
    },
    caseFile: ctx.caseFile,
    summary: leadSummary(ctx),
  };
}

export function signBody(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export const webhookAdapter: OutboundAdapter = {
  provider: "webhook",
  label: "Webhook (GoHighLevel, Zapier, anything)",
  kind: "token",
  blurb:
    "POSTs every triaged lead as JSON to a URL you choose — a GoHighLevel inbound-webhook workflow, Zapier, Make, or your own system. Optionally HMAC-signed.",
  configFields: [
    {
      key: "url",
      label: "Destination URL",
      placeholder: "https://services.leadconnectorhq.com/hooks/…",
      help: "In GoHighLevel: Automation → Workflow → trigger “Inbound Webhook”, then paste its URL here.",
    },
    {
      key: "secret",
      label: "Signing secret (optional)",
      secret: true,
      help: "When set, requests carry X-Nightshift-Signature: sha256=<HMAC-SHA256 of the body>.",
    },
  ],
  configured: (c: IntegrationConfig) => {
    const url = str(c, "url");
    return Boolean(url && /^https:\/\//.test(url));
  },

  async pushLead(integration: IntegrationRow, ctx: SyncLeadContext): Promise<SyncResult> {
    const url = str(integration.config, "url");
    if (!url || !/^https:\/\//.test(url)) {
      console.warn(`[webhook] SIMULATED lead push for firm ${ctx.firm.id} — no https URL`);
      return { status: "simulated", detail: "No destination URL configured; nothing sent." };
    }
    const body = JSON.stringify(webhookPayload(ctx));
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const secret = str(integration.config, "secret");
    if (secret) headers["X-Nightshift-Signature"] = signBody(body, secret);

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) throw new Error(`Webhook destination returned ${res.status}`);
    return { status: "sent", detail: `Delivered to ${new URL(url).host}.` };
  },
};
