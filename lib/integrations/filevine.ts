// Filevine — Personal Access Token flow (beta).
// A PAT (plus its client id) is exchanged at Filevine Identity for a bearer
// token; org and user ids come from GetUserOrgsWithToken; the claimant is then
// created as a Person in the org. Filevine deployments vary (regions, project
// types), so this adapter creates the contact and links the summary — project
// creation is left to the firm's own intake automations.
// Docs: developer.filevine.io → Authentication; support.filevine.com → PATs.

import type { IntegrationRow } from "../db/schema";
import { leadIdentity, leadSummary } from "./common";
import type { IntegrationConfig, OutboundAdapter, SyncLeadContext, SyncResult } from "./types";
import { str } from "./types";

interface FilevineSession {
  bearer: string;
  orgId: string;
  userId: string;
}

async function openSession(config: IntegrationConfig): Promise<FilevineSession> {
  const pat = str(config, "pat");
  const clientId = str(config, "clientId");
  const clientSecret = str(config, "clientSecret");
  const identityUrl = str(config, "identityUrl") ?? "https://identity.filevine.com";
  const baseUrl = str(config, "baseUrl") ?? "https://api.filevine.io";

  const form = new URLSearchParams({
    grant_type: "personal_access_token",
    token: pat ?? "",
    scope: "fv.api.gateway.access tenant filevine.v2.api.* email openid",
    client_id: clientId ?? "",
  });
  if (clientSecret) form.set("client_secret", clientSecret);

  const tokenRes = await fetch(`${identityUrl}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`Filevine identity ${tokenRes.status}: ${(await tokenRes.text()).slice(0, 300)}`);
  }
  const token = (await tokenRes.json()) as { access_token: string };

  const orgRes = await fetch(`${baseUrl}/fv-app/v2/utils/GetUserOrgsWithToken`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!orgRes.ok) {
    throw new Error(`Filevine org lookup ${orgRes.status}: ${(await orgRes.text()).slice(0, 300)}`);
  }
  const orgs = (await orgRes.json()) as {
    user?: { userId?: { native?: number } };
    orgs?: { orgId?: number }[];
  };
  const userId = orgs.user?.userId?.native;
  const preferredOrg = str(config, "orgId");
  const orgId = preferredOrg ?? orgs.orgs?.[0]?.orgId;
  if (userId == null || orgId == null) {
    throw new Error("Filevine session established but user/org ids were not returned.");
  }
  return { bearer: token.access_token, orgId: String(orgId), userId: String(userId) };
}

const filevineConfigured = (c: IntegrationConfig) => Boolean(str(c, "pat") && str(c, "clientId"));

export const filevineAdapter: OutboundAdapter = {
  provider: "filevine",
  label: "Filevine",
  kind: "token",
  blurb:
    "Creates each claimant as a Filevine contact with the case summary. Beta — verify against your Filevine org on the onboarding call.",
  configFields: [
    {
      key: "pat",
      label: "Personal Access Token",
      secret: true,
      help: "Filevine Account Manager → Access Tokens → Personal Access Tokens (Account Admin required).",
    },
    { key: "clientId", label: "Client ID", help: "Shown alongside the PAT when created." },
    { key: "clientSecret", label: "Client secret (if issued)", secret: true },
    {
      key: "orgId",
      label: "Org ID (optional)",
      help: "Only needed when your token can see more than one org.",
    },
  ],
  configured: filevineConfigured,

  async pushLead(integration: IntegrationRow, ctx: SyncLeadContext): Promise<SyncResult> {
    if (!filevineConfigured(integration.config)) {
      console.warn(`[filevine] SIMULATED lead push for firm ${ctx.firm.id} — not configured`);
      return { status: "simulated", detail: "PAT/client id not configured; nothing sent." };
    }
    const baseUrl = str(integration.config, "baseUrl") ?? "https://api.filevine.io";
    const session = await openSession(integration.config);
    const id = leadIdentity(ctx);

    const person: Record<string, unknown> = {
      fullName: id.fullName ?? ctx.lead.fromAddress,
      firstName: id.firstName ?? undefined,
      lastName: id.lastName ?? undefined,
      fromCompany: false,
      personTypes: ["Client"],
      notes: leadSummary(ctx),
    };
    if (id.email) person.emails = [{ address: id.email, label: "Home" }];
    if (id.phone) person.phones = [{ number: id.phone, label: "Mobile" }];

    const res = await fetch(`${baseUrl}/fv-app/v2/core/persons`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.bearer}`,
        "Content-Type": "application/json",
        "x-fv-orgid": session.orgId,
        "x-fv-userid": session.userId,
      },
      body: JSON.stringify(person),
    });
    if (!res.ok) {
      throw new Error(`Filevine person create ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const created = (await res.json().catch(() => ({}))) as {
      personId?: { native?: number };
    };
    return {
      status: "sent",
      externalId:
        created.personId?.native != null ? String(created.personId.native) : undefined,
      detail: "Contact created in Filevine with case summary in notes.",
    };
  },
};
