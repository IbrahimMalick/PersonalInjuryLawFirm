// Real-time notification for high-priority leads (personal injury "sign_now";
// immigration "sign_now" or time-critical). The AI can read a lead at
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
import { caseTypeLabelOf, contactOf, isImmigrationCaseFile, type AnyCaseFile } from "./casefile";

export const ESCALATION_DELAY_SECONDS = 30 * 60;

const NL = "\n";

/** Every active (non-disabled) user's email at a firm — also used by the weekly digest. */
export async function firmRecipients(firmId: number): Promise<string[]> {
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
  caseFile: AnyCaseFile,
  firmName: string
): Promise<void> {
  const recipients = await firmRecipients(lead.firmId);
  if (recipients.length === 0) return;
  const name = contactOf(caseFile).name ?? "an unnamed lead";
  const timeCritical = isImmigrationCaseFile(caseFile) && caseFile.timeCritical;
  const subject = timeCritical
    ? `TIME-CRITICAL lead — ${name} (priority ${caseFile.priorityScore})`
    : `New Sign Now lead — ${name} (priority ${caseFile.priorityScore})`;
  const body = [
    timeCritical
      ? `${firmName} just got a lead flagged time-critical — call this person now, do not wait for morning.`
      : `${firmName} just got a lead the AI routed Sign Now.`,
    "",
    // Coarse reasons only (never dates) — the exact deadlines stay behind the
    // attorney acknowledgment in Settings.
    ...(isImmigrationCaseFile(caseFile) && caseFile.timeCriticalReasons.length > 0
      ? [`Why: ${caseFile.timeCriticalReasons.join("; ")}`, ""]
      : []),
    `Priority ${caseFile.priorityScore}/100 — ${caseFile.scoreRationale}`,
    `Case type: ${caseTypeLabelOf(caseFile)}`,
    !isImmigrationCaseFile(caseFile) && caseFile.injuryDescription
      ? `Injury: ${caseFile.injuryDescription}`
      : null,
    caseFile.conflictFlags.length > 0 ? "Note: this lead is also conflict-held." : null,
    "",
    `Review and approve: ${leadUrl(lead.id)}`,
  ]
    .filter((l): l is string => l !== null)
    .join(NL);
  await notifyAll(recipients, subject, body);
}

export async function notifyEscalation(
  lead: LeadRow,
  caseFile: AnyCaseFile,
  firmName: string,
  waitedMinutes: number
): Promise<void> {
  const recipients = await firmRecipients(lead.firmId);
  if (recipients.length === 0) return;
  const name = contactOf(caseFile).name ?? "an unnamed lead";
  const timeCritical = isImmigrationCaseFile(caseFile) && caseFile.timeCritical;
  const subject = timeCritical
    ? `Still waiting — TIME-CRITICAL lead at ${firmName}`
    : `Still waiting — Sign Now lead at ${firmName}`;
  const body = [
    timeCritical
      ? `A time-critical lead has gone ${waitedMinutes} minutes without a reply.`
      : `A Sign Now lead has gone ${waitedMinutes} minutes without a reply.`,
    "",
    `${name} — priority ${caseFile.priorityScore}/100`,
    `Case type: ${caseTypeLabelOf(caseFile)}`,
    "",
    `Review and approve: ${leadUrl(lead.id)}`,
  ].join(NL);
  await notifyAll(recipients, subject, body);
}
