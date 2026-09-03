// Shared, pure helpers for CRM adapters — kept side-effect-free so payload
// construction is unit-testable without network.

import { CASE_TYPE_LABEL, ROUTING_LABEL, TREATMENT_LABEL } from "../labels";
import type { SyncLeadContext } from "./types";

const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const looksLikePhone = (s: string) => /^[+()\d][\d\s()+-]{6,}$/.test(s.trim());

export interface LeadIdentity {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
}

export function leadIdentity(ctx: SyncLeadContext): LeadIdentity {
  const cf = ctx.caseFile;
  const from = ctx.lead.fromAddress;
  const email = cf?.claimant.email ?? (looksLikeEmail(from) ? from.trim() : null);
  const phone = cf?.claimant.phone ?? (looksLikePhone(from) ? from.trim() : null);
  const fullName = cf?.claimant.name ?? ctx.lead.displayName ?? null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    firstName = parts[0];
    lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  }
  return { email, phone, firstName, lastName, fullName };
}

export function leadUrl(leadId: string): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/lead/${leadId}`;
}

/** Plain-text case summary attached as the note/description in every CRM. */
export function leadSummary(ctx: SyncLeadContext): string {
  const cf = ctx.caseFile;
  const L: string[] = [`Nightshift intake — ${ctx.firm.name}`, ""];

  if (!cf) {
    L.push(
      `Automatic triage did not complete${ctx.lead.processingError ? `: ${ctx.lead.processingError}` : ""}.`,
      "A person should read the original message.",
      "",
      "As it arrived:",
      ctx.lead.raw.slice(0, 2000)
    );
  } else {
    L.push(`Case type:  ${CASE_TYPE_LABEL[cf.caseType]}`);
    L.push(`Priority:   ${cf.priorityScore}/100 — ${cf.scoreRationale}`);
    L.push(`Routing:    ${ROUTING_LABEL[cf.routing]}`);
    if (cf.needsHumanReview) L.push("Flagged for human review.");
    if (cf.conflictFlags.length > 0) L.push(`CONFLICT HOLD: ${cf.conflictFlags.join("; ")}`);
    if (cf.injuryDescription) L.push(`Injury:     ${cf.injuryDescription}`);
    L.push(`Treatment:  ${TREATMENT_LABEL[cf.treatmentStatus]}`);
    if (cf.incidentDate) L.push(`Incident:   ${cf.incidentDate}`);
    if (cf.incidentLocation) L.push(`Location:   ${cf.incidentLocation}`);
    L.push(`Liability:  ${cf.liabilityClarity}${cf.liabilityNote ? ` — ${cf.liabilityNote}` : ""}`);
    if (cf.otherPartyInfo.name || cf.otherPartyInfo.insurer) {
      L.push(
        `Other party: ${cf.otherPartyInfo.name ?? "unknown"}` +
          (cf.otherPartyInfo.insurer ? ` · ${cf.otherPartyInfo.insurer}` : "")
      );
    }
    if (cf.missingInfo.length > 0) {
      L.push("", "Intake still needs:", ...cf.missingInfo.map((q) => `  - ${q}`));
    }
  }

  L.push("", `Channel: ${ctx.lead.channel}`, `Review in Nightshift: ${leadUrl(ctx.lead.id)}`);
  return L.join("\n");
}

/** Short one-line label, used where CRMs want a title/subject. */
export function leadTitle(ctx: SyncLeadContext): string {
  const cf = ctx.caseFile;
  const who = leadIdentity(ctx).fullName ?? ctx.lead.fromAddress;
  if (!cf) return `Nightshift lead — ${who} (needs attention)`;
  return `Nightshift lead — ${who} · ${CASE_TYPE_LABEL[cf.caseType]} · ${cf.priorityScore}/100`;
}
