// CallRail — inbound. CallRail's post-call webhook POSTs the completed call
// (caller, source, keywords, transcription when their plan includes it) to a
// per-firm URL; we ingest it as a lead so tracked marketing calls get the same
// triage as every other channel. Signature: HMAC-SHA256 of the raw body in the
// x-callrail-signature header, verified when the firm has stored the secret.
// Docs: apidocs.callrail.com → Webhooks.

import { createHmac, timingSafeEqual } from "crypto";
import type { InboundLead } from "../channels/inbound";
import type { IntegrationConfig, OutboundAdapter } from "./types";
import { str } from "./types";

export interface CallRailCall {
  id?: string | number;
  answered?: boolean;
  customer_phone_number?: string;
  customer_name?: string;
  duration?: number | string;
  recording?: string;
  transcription?: string;
  source?: string;
  keywords?: string;
  tracking_phone_number?: string;
  start_time?: string;
  [key: string]: unknown;
}

/** Pure mapper: CallRail call object → Nightshift inbound lead. */
export function mapCallRailCall(firmId: number, call: CallRailCall): InboundLead | null {
  const from = call.customer_phone_number?.trim();
  if (!from) return null;

  const lines: string[] = [];
  if (call.transcription) {
    lines.push(call.transcription);
  } else {
    lines.push(
      call.answered === false
        ? "Missed call — no transcription available from CallRail."
        : "Phone call completed — no transcription available from CallRail."
    );
  }
  const facts: string[] = [];
  if (call.source) facts.push(`Source: ${call.source}`);
  if (call.keywords) facts.push(`Keywords: ${call.keywords}`);
  if (call.duration != null) facts.push(`Duration: ${call.duration}s`);
  if (call.recording) facts.push(`Recording: ${call.recording}`);
  if (facts.length) lines.push("", `[Call tracking] ${facts.join(" · ")}`);

  return {
    firmId,
    channel: "voicemail",
    externalId: call.id != null ? `callrail:${call.id}` : undefined,
    fromAddress: from,
    displayName: call.customer_name?.trim() || null,
    raw: lines.join("\n"),
    meta: {
      via: "callrail",
      source: call.source ?? null,
      keywords: call.keywords ?? null,
      recording: call.recording ?? null,
      answered: call.answered ?? null,
      trackingNumber: call.tracking_phone_number ?? null,
      startTime: call.start_time ?? null,
    },
  };
}

/** Accepts hex or base64 HMAC-SHA256 signatures, with or without a sha256= prefix. */
export function verifyCallRailSignature(
  rawBody: string,
  header: string | null,
  secret: string
): boolean {
  if (!header) return false;
  const given = header.replace(/^sha256=/, "").trim();
  const mac = createHmac("sha256", secret).update(rawBody, "utf8");
  const digest = mac.digest();
  for (const candidate of [digest.toString("hex"), digest.toString("base64")]) {
    if (
      given.length === candidate.length &&
      timingSafeEqual(Buffer.from(given), Buffer.from(candidate))
    ) {
      return true;
    }
  }
  return false;
}

export const callrailAdapter: OutboundAdapter = {
  provider: "callrail",
  label: "CallRail",
  kind: "inbound",
  blurb:
    "CallRail's post-call webhook sends every tracked call into Nightshift — transcription, marketing source, and keywords included — so ad-driven calls get triaged like every other lead.",
  configFields: [
    {
      key: "webhookSecret",
      label: "Webhook signing secret (recommended)",
      secret: true,
      help: "CallRail generates a signing token per company; with it set, unsigned posts are rejected.",
    },
  ],
  // Inbound-only: "configured" once the firm exists — the webhook URL does the work.
  configured: (_c: IntegrationConfig) => true,
  async pushLead() {
    return { status: "skipped" as const, detail: "CallRail is inbound-only." };
  },
};

export function callrailSecretFrom(config: IntegrationConfig): string | null {
  return str(config, "webhookSecret");
}
