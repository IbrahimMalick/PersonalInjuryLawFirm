import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { audit } from "../audit";
import { getDb, tables } from "../db";
import { enqueue } from "../queue";

// Single entry point for every inbound channel. Idempotent on
// (channel, externalId) so provider webhook retries never duplicate a lead.

export interface InboundLead {
  firmId: number;
  channel: "sms" | "voicemail" | "webform" | "whatsapp" | "email";
  externalId?: string; // provider id; omit for channels without one
  fromAddress: string;
  displayName?: string | null;
  raw: string;
  meta?: Record<string, unknown>;
}

export async function ingestLead(
  inbound: InboundLead
): Promise<{ leadId: string; duplicate: boolean }> {
  const db = await getDb();
  const externalId = inbound.externalId ?? crypto.randomUUID();

  const existing = await db
    .select({ id: tables.leads.id })
    .from(tables.leads)
    .where(
      and(eq(tables.leads.channel, inbound.channel), eq(tables.leads.externalId, externalId))
    )
    .limit(1);
  if (existing[0]) return { leadId: existing[0].id, duplicate: true };

  const leadId = crypto.randomUUID();
  await db.insert(tables.leads).values({
    id: leadId,
    firmId: inbound.firmId,
    channel: inbound.channel,
    externalId,
    fromAddress: inbound.fromAddress,
    displayName: inbound.displayName ?? null,
    raw: inbound.raw.slice(0, 20_000),
    meta: inbound.meta ?? {},
    receivedAt: new Date().toISOString(),
    status: "received",
  });

  await audit("lead.received", {
    firmId: inbound.firmId,
    leadId,
    detail: { channel: inbound.channel, from: inbound.fromAddress },
  });
  await enqueue("process_lead", { leadId });
  return { leadId, duplicate: false };
}
