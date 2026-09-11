// Real-time notification for high-priority leads. The AI can read a lead at
// 3 AM, but nothing about that helps unless a person finds out — this closes
// that gap: the moment a lead routes "sign_now", every active user at the
// firm gets an email immediately, and a reminder if it's still unapproved
// 30 minutes later. Uses the same platform-email pipeline as verification
// mail (GHL or SendGrid, whichever EMAIL_PROVIDER is configured; logs and
// no-ops if neither is).

import { and, eq, isNull } from "drizzle-orm";
import { baseUrl, sendPlatformEmail } from "./email";
import { getDb, tables } from "./db";
import type { LeadRow } from "./db/schema";
import { CASE_TYPE_LABEL } from "./labels";
import type { CaseFile } from "./schema";

export const ESCALATION_DELAY_SECONDS = 30 * 60;

async function firmRecipients(firmId: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ email: tables.users.email })
    .from(tables.users)
    .where(and(eq(tables.users.firmId, firmId), isNull(tables.users.disabledAt)));
  return rows.map((r) => r.email);
}

function leadUrl(leadId: string): string {
  return `${baseUrl()}/lead/${leadId}`;
}

async function notifyAll(recipients: string[], subject: string, body: string): Promise<void> {
  await Promise.all(recipients.map((to) => sendPlatformEmail(to, subject, body)));
}

export async function notifyHighPriorityLead(
  lead: LeadRow,
  caseFile: CaseFile,
  firmName: string
): Promise<void> {
  const recipients = await firmRecipients(lead.firmId);
  if (recipients.length === 0) return;
  const name = caseFile.claimant.name ?? "an unnamed lead";
  const subject = `New Sign Now lead — ${name} (priority ${caseFile.priorityScore})`;
  const body = [
    `${firmName} just got a lead the AI routed Sign Now.`,
    "",
    `Priority ${caseFile.priorityScore}/100 — ${caseFile.scoreRationale}`,
    `Case type: ${CASE_TYPE_LABEL[caseFile.caseType]}`,
    caseFile.injuryDescription ? `Injury: ${caseFile.injuryDescription}` : null,
    caseFile.conflictFlags.length > 0 ? "Note: this lead is also conflict-held." : null,
    "",
    `Review and approve: ${leadUrl(lead.id)}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  await notifyAll(recipients, subject, body);
}

export async function notifyEscalation(
  lead: LeadRow,
  caseFile: CaseFile,
  firmName: string,
  waitedMinutes: number
): Promise<void> {
  const recipients = await firmRecipients(lead.firmId);
  if (recipients.length === 0) return;
  const name = caseFile.claimant.name ?? "an unnamed lead";
  const subject = `Still waiting — Sign Now lead at ${firmName}`;
  const body = [
    `A Sign Now lead has gone ${waitedMinutes} minutes without a reply.`,
    "",
    `${name} — priority ${caseFile.priorityScore}/100`,
    `Case type: ${CASE_TYPE_LABEL[caseFile.caseType]}`,
    "",
    `Review and approve: ${leadUrl(lead.id)}`,
  ].join("\n");
  await notifyAll(recipients, subject, body);
}
