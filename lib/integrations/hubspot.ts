// HubSpot — private-app access token. Upserts the claimant as a contact
// (matched by email when we have one) and attaches the case summary as a note.
// Docs: developers.hubspot.com → CRM API v3 (contacts, notes, associations).

import type { IntegrationRow } from "../db/schema";
import { leadIdentity, leadSummary } from "./common";
import type { IntegrationConfig, OutboundAdapter, SyncLeadContext, SyncResult } from "./types";
import { str } from "./types";

const API = "https://api.hubapi.com";
// Default association type: note → contact.
const NOTE_TO_CONTACT = 202;

export function hubspotContactProperties(ctx: SyncLeadContext) {
  const id = leadIdentity(ctx);
  const props: Record<string, string> = {
    lifecyclestage: "lead",
    hs_lead_status: "NEW",
  };
  if (id.email) props.email = id.email;
  if (id.phone) props.phone = id.phone;
  if (id.firstName) props.firstname = id.firstName;
  if (id.lastName) props.lastname = id.lastName;
  return props;
}

async function hs(
  token: string,
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<Response> {
  return fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

async function findContactByEmail(token: string, email: string): Promise<string | null> {
  const res = await hs(token, "/crm/v3/objects/contacts/search", {
    method: "POST",
    body: {
      filterGroups: [
        { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
      ],
      properties: ["email"],
      limit: 1,
    },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { results?: { id: string }[] };
  return body.results?.[0]?.id ?? null;
}

export const hubspotAdapter: OutboundAdapter = {
  provider: "hubspot",
  label: "HubSpot",
  kind: "token",
  blurb:
    "Leads are upserted as HubSpot contacts (lifecycle stage: lead) with the case summary logged as a note.",
  configFields: [
    {
      key: "accessToken",
      label: "Private app access token",
      secret: true,
      help: "HubSpot → Settings → Integrations → Private Apps. Scopes: crm.objects.contacts.write, crm.objects.contacts.read.",
    },
  ],
  configured: (c: IntegrationConfig) => Boolean(str(c, "accessToken")),

  async pushLead(integration: IntegrationRow, ctx: SyncLeadContext): Promise<SyncResult> {
    const token = str(integration.config, "accessToken");
    if (!token) {
      console.warn(`[hubspot] SIMULATED lead push for firm ${ctx.firm.id} — no access token`);
      return { status: "simulated", detail: "No private-app token configured; nothing sent." };
    }
    const id = leadIdentity(ctx);
    if (!id.email && !id.phone) {
      return { status: "skipped", detail: "Lead has no email or phone to key a contact on." };
    }

    const properties = hubspotContactProperties(ctx);
    let contactId: string | null = id.email ? await findContactByEmail(token, id.email) : null;

    if (contactId) {
      const res = await hs(token, `/crm/v3/objects/contacts/${contactId}`, {
        method: "PATCH",
        body: { properties },
      });
      if (!res.ok) throw new Error(`HubSpot update ${res.status}: ${await res.text()}`);
    } else {
      const res = await hs(token, "/crm/v3/objects/contacts", {
        method: "POST",
        body: { properties },
      });
      if (res.status === 409 && id.email) {
        // Raced an existing contact; fetch and update instead.
        contactId = await findContactByEmail(token, id.email);
        if (!contactId) throw new Error(`HubSpot conflict without findable contact`);
      } else if (!res.ok) {
        throw new Error(`HubSpot create ${res.status}: ${await res.text()}`);
      } else {
        contactId = ((await res.json()) as { id: string }).id;
      }
    }

    const note = await hs(token, "/crm/v3/objects/notes", {
      method: "POST",
      body: {
        properties: {
          hs_note_body: leadSummary(ctx).slice(0, 65000),
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: contactId },
            types: [
              { associationCategory: "HUBSPOT_DEFINED", associationTypeId: NOTE_TO_CONTACT },
            ],
          },
        ],
      },
    });

    return {
      status: "sent",
      externalId: contactId ?? undefined,
      detail: note.ok
        ? "Contact upserted with case summary note."
        : "Contact upserted; note attachment failed (check token scopes).",
    };
  },
};
