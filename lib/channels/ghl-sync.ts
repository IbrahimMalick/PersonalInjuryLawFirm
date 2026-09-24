// Push every processed lead into GoHighLevel as a contact + note, so GHL is the
// single place all Nightshift leads land. Active when GHL_SYNC_LEADS=true and the
// GHL API is configured (GHL_API_TOKEN + GHL_LOCATION_ID). Uses the same Private
// Integration token as the email adapter — needs contacts.write.
//
// All leads across all firms sync into the one GHL_LOCATION_ID. That's right for a
// single-agency deployment; a true multi-tenant setup would map firm -> location.
//
// Never throws: a GHL outage must not fail lead processing.

import { caseTypeLabelOf, contactOf, isImmigrationCaseFile, type AnyCaseFile } from "../casefile";
import {
  CURRENT_STATUS_LABEL,
  NOTICE_TYPE_LABEL,
  ROUTING_LABEL,
  TREATMENT_LABEL,
} from "../labels";
import { GHL_API, ghlApiConfigured, ghlHeaders } from "./ghl";

export function ghlSyncEnabled(): boolean {
  return process.env.GHL_SYNC_LEADS === "true" && ghlApiConfigured();
}

export interface LeadSyncInput {
  leadId: string;
  channel: string;
  fromAddress: string;
  displayName: string | null;
  raw: string;
  firmName: string;
  /** The triaged case file, or null when automatic triage failed. */
  caseFile: AnyCaseFile | null;
  processingError?: string | null;
  /**
   * Whether an attorney at the firm has acknowledged the deadline table. Until
   * then the note carries no computed deadline (SOL or immigration) — the same
   * gate the review screen applies. Callers pass it explicitly; omitted means
   * visible.
   */
  deadlinesVisible?: boolean;
}

const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const looksLikePhone = (s: string) => /^[+()\d][\d\s()+-]{6,}$/.test(s.trim());

function leadUrl(leadId: string): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/lead/${leadId}`;
}

function contactIdentity(input: LeadSyncInput): { email?: string; phone?: string; name?: string } {
  const contact = input.caseFile ? contactOf(input.caseFile) : null;
  const email =
    contact?.email ?? (looksLikeEmail(input.fromAddress) ? input.fromAddress.trim() : undefined);
  const phone =
    contact?.phone ?? (looksLikePhone(input.fromAddress) ? input.fromAddress.trim() : undefined);
  const name = contact?.name ?? input.displayName ?? undefined;
  return { email, phone, name };
}

function tagsFor(input: LeadSyncInput): string[] {
  const tags = ["Nightshift Lead", `Nightshift Channel: ${input.channel}`];
  const cf = input.caseFile;
  if (!cf) {
    tags.push("Nightshift: Needs Attention");
    return tags;
  }
  tags.push(`Nightshift Case: ${caseTypeLabelOf(cf)}`);
  tags.push(`Nightshift Routing: ${ROUTING_LABEL[cf.routing]}`);
  if (isImmigrationCaseFile(cf) && cf.timeCritical) tags.push("Nightshift: TIME-CRITICAL");
  if (cf.conflictFlags.length > 0) tags.push("Nightshift: CONFLICT");
  if (cf.needsHumanReview) tags.push("Nightshift: Needs Review");
  return tags;
}

export function noteBody(input: LeadSyncInput): string {
  const cf = input.caseFile;
  const L: string[] = [`Nightshift intake — ${input.firmName}`, ""];

  if (!cf) {
    L.push(`Automatic triage did not complete: ${input.processingError ?? "unknown error"}`);
    L.push("", "As it arrived:", input.raw.slice(0, 2000));
  } else if (isImmigrationCaseFile(cf)) {
    L.push(`Case type:   ${caseTypeLabelOf(cf)}`);
    L.push(`Priority:    ${cf.priorityScore}/100`);
    L.push(`Rationale:   ${cf.scoreRationale}`);
    L.push(`Routing:     ${ROUTING_LABEL[cf.routing]}`);
    L.push(`Confidence:  ${Math.round(cf.confidence * 100)}%`);
    if (cf.timeCritical) L.push(`TIME-CRITICAL: ${cf.timeCriticalReasons.join("; ")}`);
    if (cf.needsHumanReview) L.push("Flagged for human review.");
    if (cf.conflictFlags.length > 0) L.push(`CONFLICT HOLD: ${cf.conflictFlags.join("; ")}`);
    L.push("");
    L.push(
      `Status:      ${CURRENT_STATUS_LABEL[cf.currentStatus]}` +
        (cf.currentStatusDetail ? ` (${cf.currentStatusDetail})` : "")
    );
    if (cf.applicant.countryOfCitizenship) L.push(`Citizenship: ${cf.applicant.countryOfCitizenship}`);
    if (cf.noticeReceived.type !== "none" && cf.noticeReceived.type !== "unknown") {
      L.push(
        `Notice:      ${NOTICE_TYPE_LABEL[cf.noticeReceived.type]}` +
          (cf.noticeReceived.noticeDate ? ` (${cf.noticeReceived.noticeDate})` : "")
      );
    }
    if (cf.pendingFiling.formType) L.push(`Filing:      ${cf.pendingFiling.formType}`);
    if (cf.removal.isDetained === true) L.push("Detained:    yes (as reported)");
    // Computed deadlines only once an attorney has acknowledged the table —
    // the same gate as the review screen.
    if (input.deadlinesVisible) {
      for (const d of cf.deadlines) {
        L.push(
          d.kind === "computed"
            ? `Deadline:    ${d.label} — ${d.deadlineISO} — ${d.daysRemaining} days left — ${d.basis}`
            : `Deadline:    ${d.label} — ${d.basis}`
        );
      }
    }
    if (cf.missingInfo.length > 0) {
      L.push("", "Intake still needs:");
      cf.missingInfo.forEach((q) => L.push(`  - ${q}`));
    }
  } else {
    L.push(`Case type:   ${caseTypeLabelOf(cf)}`);
    L.push(`Priority:    ${cf.priorityScore}/100`);
    L.push(`Rationale:   ${cf.scoreRationale}`);
    L.push(`Routing:     ${ROUTING_LABEL[cf.routing]}`);
    L.push(`Confidence:  ${Math.round(cf.confidence * 100)}%`);
    if (cf.needsHumanReview) L.push("Flagged for human review.");
    if (cf.conflictFlags.length > 0) L.push(`CONFLICT HOLD: ${cf.conflictFlags.join("; ")}`);
    L.push("");
    if (cf.injuryDescription) L.push(`Injury:      ${cf.injuryDescription}`);
    L.push(`Treatment:   ${TREATMENT_LABEL[cf.treatmentStatus]}`);
    if (cf.incidentDate) L.push(`Incident:    ${cf.incidentDate}`);
    if (cf.incidentLocation) L.push(`Location:    ${cf.incidentLocation}`);
    L.push(
      `Liability:   ${cf.liabilityClarity}${cf.liabilityNote ? ` — ${cf.liabilityNote}` : ""}`
    );
    if (cf.otherPartyInfo.name || cf.otherPartyInfo.insurer) {
      L.push(
        `Other party: ${cf.otherPartyInfo.name ?? "unknown"}` +
          (cf.otherPartyInfo.insurer ? ` (${cf.otherPartyInfo.insurer})` : "")
      );
    }
    const sol = cf.statuteOfLimitations;
    // Same gate as the review screen: no computed deadline leaves the app
    // until an attorney at the firm has acknowledged the table.
    if (sol.deadlineISO && input.deadlinesVisible !== false) {
      L.push(`SOL:         ${sol.deadlineISO} — ${sol.daysRemaining} days left — ${sol.basis}`);
    }
    if (cf.missingInfo.length > 0) {
      L.push("", "Intake still needs:");
      cf.missingInfo.forEach((q) => L.push(`  - ${q}`));
    }
  }

  L.push("", `Channel: ${input.channel}`, `Review in Nightshift: ${leadUrl(input.leadId)}`);
  return L.join("\n");
}

async function upsertContact(input: LeadSyncInput): Promise<string> {
  const { email, phone, name } = contactIdentity(input);
  if (!email && !phone) {
    throw new Error("lead has no email or phone — cannot identify a GHL contact");
  }

  const body: Record<string, unknown> = {
    locationId: process.env.GHL_LOCATION_ID,
    source: "Nightshift Intake",
    tags: tagsFor(input),
  };
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (name) {
    const parts = name.trim().split(/\s+/);
    body.name = name;
    body.firstName = parts[0];
    if (parts.length > 1) body.lastName = parts.slice(1).join(" ");
  }

  const res = await fetch(`${GHL_API}/contacts/upsert`, {
    method: "POST",
    headers: ghlHeaders("2021-07-28"),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`contacts/upsert ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { contact?: { id?: string } };
  if (!data.contact?.id) throw new Error("contacts/upsert returned no contact id");
  return data.contact.id;
}

async function addNote(contactId: string, body: string): Promise<void> {
  const res = await fetch(`${GHL_API}/contacts/${contactId}/notes`, {
    method: "POST",
    headers: ghlHeaders("2021-07-28"),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    throw new Error(`contacts/${contactId}/notes ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

/** Fire-and-forget from the caller's perspective — logs failures, never throws. */
export async function syncLeadToGhl(input: LeadSyncInput): Promise<void> {
  if (!ghlSyncEnabled()) return;
  try {
    const contactId = await upsertContact(input);
    await addNote(contactId, noteBody(input));
    console.log(`[ghl-sync] lead ${input.leadId} → contact ${contactId}`);
  } catch (e) {
    console.error(`[ghl-sync] lead ${input.leadId} failed: ${(e as Error).message}`);
  }
}
