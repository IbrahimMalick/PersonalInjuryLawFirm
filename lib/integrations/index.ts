// Registry + dispatch for CRM integrations. Outbound syncs run as sync_lead
// queue jobs — one per (lead, integration) — so a provider outage retries with
// backoff and can never block lead processing or another provider's sync.

import { and, eq } from "drizzle-orm";
import { audit } from "../audit";
import { getDb, tables } from "../db";
import type { FirmRow, IntegrationProvider, IntegrationRow } from "../db/schema";
import { enqueue } from "../queue";
import type { CaseFile } from "../schema";
import { callrailAdapter } from "./callrail";
import { clioGrowAdapter } from "./clio-grow";
import { filevineAdapter } from "./filevine";
import { hubspotAdapter } from "./hubspot";
import { lawmaticsAdapter } from "./lawmatics";
import { mycaseAdapter } from "./mycase";
import type { OutboundAdapter, SyncLeadContext, SyncResult } from "./types";
import { webhookAdapter } from "./webhook";

export const ADAPTERS: OutboundAdapter[] = [
  webhookAdapter,
  clioGrowAdapter,
  hubspotAdapter,
  lawmaticsAdapter,
  filevineAdapter,
  mycaseAdapter,
  callrailAdapter,
];

export function adapterFor(provider: IntegrationProvider): OutboundAdapter {
  const a = ADAPTERS.find((x) => x.provider === provider);
  if (!a) throw new Error(`No adapter for provider ${provider}`);
  return a;
}

export async function getFirmIntegrations(firmId: number): Promise<IntegrationRow[]> {
  const db = await getDb();
  return db.select().from(tables.integrations).where(eq(tables.integrations.firmId, firmId));
}

export async function upsertIntegration(
  firmId: number,
  provider: IntegrationProvider,
  patch: { config?: Record<string, unknown>; enabled?: boolean }
): Promise<IntegrationRow> {
  const db = await getDb();
  const existing = (
    await db
      .select()
      .from(tables.integrations)
      .where(
        and(eq(tables.integrations.firmId, firmId), eq(tables.integrations.provider, provider))
      )
      .limit(1)
  )[0];

  if (existing) {
    const rows = await db
      .update(tables.integrations)
      .set({
        config: patch.config ? { ...existing.config, ...patch.config } : existing.config,
        enabled: patch.enabled ?? existing.enabled,
        lastError: null,
      })
      .where(eq(tables.integrations.id, existing.id))
      .returning();
    return rows[0];
  }
  const rows = await db
    .insert(tables.integrations)
    .values({ firmId, provider, config: patch.config ?? {}, enabled: patch.enabled ?? true })
    .returning();
  return rows[0];
}

/** Queue one sync job per enabled outbound integration for this firm. */
export async function enqueueLeadSyncs(firmId: number, leadId: string): Promise<void> {
  const rows = await getFirmIntegrations(firmId);
  for (const row of rows) {
    if (!row.enabled) continue;
    const adapter = adapterFor(row.provider);
    if (adapter.kind === "inbound") continue;
    await enqueue("sync_lead", { leadId, integrationId: row.id });
  }
}

/** Worker entry point for a sync_lead job. Throws to trigger queue retry. */
export async function runSyncLead(payload: Record<string, unknown>): Promise<void> {
  const leadId = String(payload.leadId ?? "");
  const integrationId = Number(payload.integrationId ?? 0);
  const db = await getDb();

  const integration = (
    await db
      .select()
      .from(tables.integrations)
      .where(eq(tables.integrations.id, integrationId))
      .limit(1)
  )[0];
  if (!integration || !integration.enabled) return; // removed/disabled since enqueue — drop

  const lead = (
    await db.select().from(tables.leads).where(eq(tables.leads.id, leadId)).limit(1)
  )[0];
  if (!lead || lead.firmId !== integration.firmId) return;

  // Idempotency across job retries after partial success: one synced audit
  // event per (lead, integration) means we're done.
  const already = await db
    .select({ id: tables.auditEvents.id, detail: tables.auditEvents.detail })
    .from(tables.auditEvents)
    .where(and(eq(tables.auditEvents.leadId, leadId), eq(tables.auditEvents.type, "integration.synced")));
  if (already.some((e) => (e.detail as { integrationId?: number })?.integrationId === integrationId)) {
    return;
  }

  const firm = (
    await db.select().from(tables.firms).where(eq(tables.firms.id, integration.firmId)).limit(1)
  )[0] as FirmRow | undefined;
  if (!firm) return;

  const ctx: SyncLeadContext = {
    firm,
    lead,
    caseFile: (lead.caseFile as CaseFile | null) ?? null,
  };

  const adapter = adapterFor(integration.provider);
  try {
    const result = await adapter.pushLead(integration, ctx);
    await db
      .update(tables.integrations)
      .set({ lastSyncAt: new Date().toISOString(), lastError: null })
      .where(eq(tables.integrations.id, integration.id));
    await audit("integration.synced", {
      firmId: firm.id,
      leadId,
      detail: {
        integrationId: integration.id,
        provider: integration.provider,
        status: result.status,
        externalId: result.externalId ?? null,
        detail: result.detail,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(tables.integrations)
      .set({ lastError: message.slice(0, 1000) })
      .where(eq(tables.integrations.id, integration.id));
    await audit("integration.failed", {
      firmId: firm.id,
      leadId,
      detail: { integrationId: integration.id, provider: integration.provider, error: message.slice(0, 500) },
    });
    throw err; // queue retries with backoff; dead-letter leaves lastError visible
  }
}

/** Settings "send test": push a fixture lead through one integration, live. */
export async function pushTestLead(integration: IntegrationRow, firm: FirmRow): Promise<SyncResult> {
  const adapter = adapterFor(integration.provider);
  const now = new Date().toISOString();
  const ctx: SyncLeadContext = {
    firm,
    lead: {
      id: "00000000-0000-0000-0000-000000000000",
      firmId: firm.id,
      channel: "webform",
      externalId: null,
      fromAddress: "test@nightshift.example",
      displayName: "Nightshift Test",
      raw: "This is a Nightshift integration test — safe to delete on the CRM side.",
      meta: { test: true },
      receivedAt: now,
      status: "triaged",
      caseFile: null,
      draftReply: null,
      draftLanguage: "en",
      processedAt: now,
      processingError: null,
      reviewedBy: null,
      reviewedAt: null,
    },
    caseFile: null,
  };
  return adapter.pushLead(integration, ctx);
}
