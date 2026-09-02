import { and, eq } from "drizzle-orm";
import { audit } from "./audit";
import { getDb, tables } from "./db";
import type { LeadRow } from "./db/schema";
import { buildCaseFile, extractModelOutput, type ExtractionInput } from "./extract";
import { getFirmById } from "./firm";
import type { CaseFile, Channel } from "./schema";
import { sendViaChannel } from "./channels/outbound";

// The live processing pipeline. Jobs land here from the worker.
// Product rule: a real inquiry NEVER receives a cached/canned result — if
// extraction fails after retries, the lead is flagged for a human.

function receivedLabel(iso: string, timezone: string): string {
  try {
    return new Date(iso + (iso.endsWith("Z") ? "" : "Z")).toLocaleString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function toExtractionInput(lead: LeadRow, timezone: string): ExtractionInput {
  return {
    id: lead.id,
    channel: lead.channel as Channel | "email",
    from: lead.fromAddress,
    displayName: lead.displayName,
    raw: lead.raw,
    meta: (lead.meta ?? undefined) as ExtractionInput["meta"],
    receivedLabel: receivedLabel(lead.receivedAt, timezone),
  };
}

export async function runProcessLead(leadId: string): Promise<void> {
  const db = await getDb();
  const lead = (
    await db.select().from(tables.leads).where(eq(tables.leads.id, leadId)).limit(1)
  )[0];
  if (!lead) throw new Error(`Lead ${leadId} not found`);
  if (lead.status === "triaged" || lead.status === "archived") return; // idempotent

  const firm = await getFirmById(lead.firmId);
  if (!firm) throw new Error(`Firm ${lead.firmId} not found for lead ${leadId}`);
  await db
    .update(tables.leads)
    .set({ status: "processing", processingError: null })
    .where(eq(tables.leads.id, leadId));

  const parties = (
    await db
      .select()
      .from(tables.adverseParties)
      .where(
        and(
          eq(tables.adverseParties.firmId, lead.firmId),
          eq(tables.adverseParties.active, true)
        )
      )
  ).map((p) => ({ name: p.name, relationship: p.relationship }));

  const result = await extractModelOutput(toExtractionInput(lead, firm.timezone), {
    firmName: `${firm.name} ${firm.practiceLine}`.trim(),
    allowFallback: false, // throws on failure → worker retries → dead → needs_attention
  });

  const { caseFile, draftReply } = buildCaseFile(result.output, lead.raw, parties);

  await db
    .update(tables.leads)
    .set({
      status: "triaged",
      caseFile: caseFile as unknown as Record<string, unknown>,
      draftReply,
      draftLanguage: caseFile.claimant.preferredLanguage ?? "en",
      processedAt: new Date().toISOString(),
      processingError: null,
    })
    .where(eq(tables.leads.id, leadId));

  await audit("lead.triaged", {
    firmId: lead.firmId,
    leadId,
    detail: {
      routing: caseFile.routing,
      priority: caseFile.priorityScore,
      caseType: caseFile.caseType,
      confidence: caseFile.confidence,
      needsHumanReview: caseFile.needsHumanReview,
      retried: result.retried,
      retryReason: result.retryReason,
      model: "claude-sonnet-4-6",
    },
  });

  for (const flag of caseFile.conflictFlags) {
    await audit("conflict.flagged", { firmId: lead.firmId, leadId, detail: { match: flag } });
  }
}

/** Called by the worker when a process_lead job exhausts its retries. */
export async function markLeadNeedsAttention(leadId: string, error: string): Promise<void> {
  const db = await getDb();
  const lead = (
    await db.select().from(tables.leads).where(eq(tables.leads.id, leadId)).limit(1)
  )[0];
  await db
    .update(tables.leads)
    .set({ status: "needs_attention", processingError: error.slice(0, 2000) })
    .where(eq(tables.leads.id, leadId));
  await audit("extraction.failed", {
    firmId: lead?.firmId ?? null,
    leadId,
    detail: { error: error.slice(0, 500) },
  });
}

export async function runSendMessage(messageId: number): Promise<void> {
  const db = await getDb();
  const message = (
    await db.select().from(tables.messages).where(eq(tables.messages.id, messageId)).limit(1)
  )[0];
  if (!message) throw new Error(`Message ${messageId} not found`);
  if (message.status !== "queued") return; // idempotent

  const firm = await getFirmById(message.firmId);
  if (!firm) throw new Error(`Firm ${message.firmId} not found for message ${messageId}`);
  const outcome = await sendViaChannel(message, firm);
  await db
    .update(tables.messages)
    .set({
      status: outcome.status,
      sentAt: new Date().toISOString(),
      providerId: outcome.providerId ?? null,
      error: outcome.error ?? null,
    })
    .where(eq(tables.messages.id, messageId));

  await audit(outcome.status === "failed" ? "message.failed" : "message.sent", {
    firmId: message.firmId,
    leadId: message.leadId,
    detail: {
      messageId,
      channel: message.channel,
      to: message.toAddress,
      status: outcome.status,
      providerId: outcome.providerId,
      error: outcome.error,
    },
  });
  if (outcome.status === "failed") {
    throw new Error(outcome.error ?? "send failed");
  }
}

export type { CaseFile };
