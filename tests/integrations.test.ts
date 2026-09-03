import { describe, expect, it } from "vitest";
import type { FirmRow, LeadRow } from "../lib/db/schema";
import type { CaseFile } from "../lib/schema";
import { leadIdentity, leadSummary, leadTitle } from "../lib/integrations/common";
import { clioGrowPayload } from "../lib/integrations/clio-grow";
import { hubspotContactProperties } from "../lib/integrations/hubspot";
import { lawmaticsProspectPayload } from "../lib/integrations/lawmatics";
import { mycaseLeadPayload } from "../lib/integrations/mycase";
import { webhookPayload, signBody } from "../lib/integrations/webhook";
import { mapCallRailCall, verifyCallRailSignature } from "../lib/integrations/callrail";
import { createHmac } from "crypto";

const firm = { id: 7, name: "Reyes & Cole", slug: "reyes-and-cole" } as FirmRow;

const lead = {
  id: "lead-1",
  firmId: 7,
  channel: "sms",
  fromAddress: "+13475550100",
  displayName: null,
  raw: "Hit by a car on Flatbush.",
  receivedAt: "2026-09-03T03:12:00.000Z",
  status: "triaged",
  processingError: null,
} as LeadRow;

const caseFile = {
  caseType: "motor_vehicle",
  incidentDate: "2026-08-20",
  incidentLocation: "Flatbush Ave, Brooklyn",
  claimant: { name: "Dana Ortiz", phone: "(929) 555-0177", email: null, preferredLanguage: "en" },
  injuryDescription: "Back and shoulder pain",
  treatmentStatus: "er_visit",
  liabilityClarity: "clear",
  liabilityNote: "Ran a red light.",
  otherPartyInfo: { name: null, insurer: "GEICO", policyLimits: null },
  priorRepresentation: false,
  statuteOfLimitations: {
    jurisdiction: "NY",
    deadlineISO: "2029-08-20",
    daysRemaining: 1082,
    basis: "NY CPLR § 214(5)",
  },
  priorityScore: 82,
  scoreRationale: "Clear liability with ER documentation.",
  routing: "sign_now",
  missingInfo: ["Police report number"],
  conflictFlags: [],
  confidence: 0.88,
  needsHumanReview: true,
} as unknown as CaseFile;

const ctx = { firm, lead, caseFile };
const ctxFailed = { firm, lead: { ...lead, status: "needs_attention" } as LeadRow, caseFile: null };

describe("leadIdentity", () => {
  it("prefers extracted contact info and splits names", () => {
    const id = leadIdentity(ctx);
    expect(id.phone).toBe("(929) 555-0177");
    expect(id.firstName).toBe("Dana");
    expect(id.lastName).toBe("Ortiz");
    expect(id.email).toBeNull();
  });
  it("falls back to the channel address", () => {
    const id = leadIdentity(ctxFailed);
    expect(id.phone).toBe("+13475550100");
    expect(id.fullName).toBeNull();
  });
});

describe("leadSummary", () => {
  it("carries the trust-boundary facts", () => {
    const s = leadSummary(ctx);
    expect(s).toContain("Priority:   82/100");
    expect(s).toContain("Police report number");
    expect(s).toContain("/lead/lead-1");
  });
  it("is honest about failed triage", () => {
    const s = leadSummary(ctxFailed);
    expect(s).toContain("Automatic triage did not complete");
    expect(s).toContain("Hit by a car on Flatbush.");
  });
  it("titles the lead with score", () => {
    expect(leadTitle(ctx)).toContain("Dana Ortiz");
    expect(leadTitle(ctxFailed)).toContain("needs attention");
  });
});

describe("provider payloads", () => {
  it("clio grow wraps the inbox token and identity", () => {
    const p = clioGrowPayload(ctx, "tok123");
    expect(p.inbox_lead_token).toBe("tok123");
    expect(p.inbox_lead.from_first).toBe("Dana");
    expect(p.inbox_lead.from_phone).toBe("(929) 555-0177");
    expect(p.inbox_lead.from_source).toBe("Nightshift Intake");
  });
  it("hubspot maps names to hubspot property keys", () => {
    const p = hubspotContactProperties(ctx);
    expect(p.firstname).toBe("Dana");
    expect(p.lifecyclestage).toBe("lead");
  });
  it("lawmatics and mycase build first/last + summary", () => {
    expect(lawmaticsProspectPayload(ctx).first_name).toBe("Dana");
    expect(mycaseLeadPayload(ctx).cell_phone).toBe("(929) 555-0177");
    expect(mycaseLeadPayload(ctxFailed).first_name).toBe("Unknown");
  });
  it("webhook payload names the event by lead state", () => {
    expect(webhookPayload(ctx).event).toBe("lead.triaged");
    expect(webhookPayload(ctxFailed).event).toBe("lead.needs_attention");
  });
  it("webhook signature is a stable sha256 hmac", () => {
    const sig = signBody('{"a":1}', "secret");
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signBody('{"a":1}', "secret")).toBe(sig);
    expect(signBody('{"a":2}', "secret")).not.toBe(sig);
  });
});

describe("callrail", () => {
  const call = {
    id: 987,
    answered: false,
    customer_phone_number: "+17135550123",
    customer_name: "Sam Caller",
    duration: 42,
    transcription: "Hi, I was rear-ended on I-45 yesterday...",
    source: "Google Ads",
    keywords: "houston injury lawyer",
    recording: "https://app.callrail.com/rec/987",
  };
  it("maps a tracked call to an inbound voicemail lead", () => {
    const lead = mapCallRailCall(7, call)!;
    expect(lead.channel).toBe("voicemail");
    expect(lead.externalId).toBe("callrail:987");
    expect(lead.raw).toContain("rear-ended on I-45");
    expect(lead.raw).toContain("Source: Google Ads");
    expect(lead.meta?.keywords).toBe("houston injury lawyer");
  });
  it("still ingests calls without transcription, honestly labeled", () => {
    const lead = mapCallRailCall(7, { ...call, transcription: undefined })!;
    expect(lead.raw).toContain("Missed call — no transcription");
  });
  it("drops payloads without a caller number", () => {
    expect(mapCallRailCall(7, { id: 1 })).toBeNull();
  });
  it("verifies hex and base64 hmac signatures, rejects tampering", () => {
    const body = JSON.stringify(call);
    const hex = createHmac("sha256", "s3cret").update(body).digest("hex");
    const b64 = createHmac("sha256", "s3cret").update(body).digest("base64");
    expect(verifyCallRailSignature(body, hex, "s3cret")).toBe(true);
    expect(verifyCallRailSignature(body, `sha256=${b64}`, "s3cret")).toBe(true);
    expect(verifyCallRailSignature(body + " ", hex, "s3cret")).toBe(false);
    expect(verifyCallRailSignature(body, null, "s3cret")).toBe(false);
  });
});
