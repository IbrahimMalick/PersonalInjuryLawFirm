import { and, eq } from "drizzle-orm";
import { audit } from "./audit";
import { ESCALATION_DELAY_SECONDS, notifyEscalation, notifyHighPriorityLead } from "./alerts";
import { getDb, tables } from "./db";
import type { LeadRow } from "./db/schema";
import {
  contactOf,
  isHighPriority,
  isImmigrationCaseFile,
  type AnyCaseFile,
} from "./casefile";
import type { ExtractionInput } from "./extract";
import { getFirmById } from "./firm";
import { processLeadForArea } from "./practice-areas";
import { enqueue } from "./queue";
import type { CaseFile, Channel } from "./schema";
import { sendViaChannel } from "./channels/outbound";
import { syncLeadToGhl } from "./channels/ghl-sync";

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

// The public immigration form asks "is anyone currently detained?" — the one
// explicit yes/no we can hand to code as a backstop for the model's reading.
export const FORM_DETAINED_KEY = "Currently detained";

function formDetainedAnswer(lead: LeadRow): boolean | undefined {
  const fields = (lead.meta as { formFields?: Record<string, string> } | null)?.formFields;
  return fields?.[FORM_DETAINED_KEY] === "Yes" ? true : undefined;
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

  // Throws on failure → worker retries → dead → needs_attention. A real
  // inquiry never gets a canned answer, in any practice area.
  const result = await processLeadForArea(firm.practiceArea, {
    input: toExtractionInput(lead, firm.timezone),
    firm: { name: firm.name, practiceLine: firm.practiceLine },
    rawText: lead.raw,
    parties,
    formDetained: formDetainedAnswer(lead),
  });
  const { caseFile, draftReply } = result;

  await db
    .update(tables.leads)
    .set({
      status: "triaged",
      caseFile: caseFile as unknown as Record<string, unknown>,
      draftReply,
      draftLanguage: contactOf(caseFile).preferredLanguage ?? "en",
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
      practiceArea: firm.practiceArea,
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

  // Immigration: a detained person or an imminent hearing is a liberty issue.
  // Record which categories fired (coarse — never dates) for the audit trail.
  if (isImmigrationCaseFile(caseFile) && caseFile.timeCritical) {
    await audit("lead.time_critical", {
      firmId: lead.firmId,
      leadId,
      detail: { reasons: caseFile.timeCriticalReasons },
    });
  }

  // The AI read this at 3 AM — that only matters if a person finds out now,
  // not whenever they next happen to open the inbox. Never let an alert
  // failure fail the triage that already succeeded.
  if (isHighPriority(caseFile)) {
    try {
      await notifyHighPriorityLead(lead, caseFile, firm.name);
      await audit("lead.alert_sent", { firmId: lead.firmId, leadId, detail: { channel: "email" } });
    } catch (e) {
      console.error(`[alerts] notify failed for ${leadId}: ${(e as Error).message}`);
    }
    await enqueue("escalate_lead", { leadId }, { delaySeconds: ESCALATION_DELAY_SECONDS });
  }

  await syncLeadToGhl({
    leadId,
    channel: lead.channel,
    fromAddress: lead.fromAddress,
    displayName: lead.displayName,
    raw: lead.raw,
    firmName: firm.name,
    caseFile,
    deadlinesVisible: Boolean(firm.solAcknowledgedAt),
  });
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

  if (lead) {
    const firm = await getFirmById(lead.firmId);
    await syncLeadToGhl({
      leadId,
      channel: lead.channel,
      fromAddress: lead.fromAddress,
      displayName: lead.displayName,
      raw: lead.raw,
      firmName: firm?.name ?? "Unknown firm",
      caseFile: null,
      processingError: error,
    });
  }
}

/**
 * Fires ESCALATION_DELAY_SECONDS after a high-priority lead ("sign_now", or an
 * immigration lead flagged time-critical) is triaged. A no-op if it's since
 * been replied to, archived, or re-triaged away from high priority — so
 * re-running triage on the same lead can leave a stale reminder queued without
 * it saying anything wrong.
 */
export async function runEscalateLead(leadId: string): Promise<void> {
  const db = await getDb();
  const lead = (
    await db.select().from(tables.leads).where(eq(tables.leads.id, leadId)).limit(1)
  )[0];
  if (!lead || lead.status === "archived") return;

  const replied = (
    await db
      .select({ id: tables.messages.id })
      .from(tables.messages)
      .where(eq(tables.messages.leadId, leadId))
      .limit(1)
  )[0];
  if (replied) return;

  const caseFile = (lead.caseFile as unknown as AnyCaseFile | null) ?? null;
  if (!caseFile || !isHighPriority(caseFile)) return;

  const firm = await getFirmById(lead.firmId);
  if (!firm) return;

  const receivedMs = new Date(
    lead.receivedAt.endsWith("Z") ? lead.receivedAt : lead.receivedAt + "Z"
  ).getTime();
  const waitedMinutes = Math.round((Date.now() - receivedMs) / 60_000);

  await notifyEscalation(lead, caseFile, firm.name, waitedMinutes);
  await audit("lead.escalated", { firmId: lead.firmId, leadId, detail: { waitedMinutes } });
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
