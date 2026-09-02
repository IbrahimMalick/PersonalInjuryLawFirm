import { and, eq } from "drizzle-orm";
import { getDb, tables } from "../db";
import type { FirmRow } from "../db/schema";
import { ingestLead } from "./inbound";

// Twilio inbound, multi-tenant: the platform owns one Twilio account; each
// firm gets a number, and inbound requests are routed to the firm by the
// number that was dialed/texted (the To parameter). All handlers verify
// Twilio's request signature — an unsigned request never creates a lead.

export function twilioWebhooksEnabled(): boolean {
  return Boolean(process.env.TWILIO_AUTH_TOKEN);
}

export async function verifyTwilioSignature(
  request: Request,
  params: Record<string, string>
): Promise<boolean> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;
  const { default: twilio } = await import("twilio");
  const base = process.env.PUBLIC_BASE_URL;
  const url = base ? `${base}${new URL(request.url).pathname}` : request.url;
  return twilio.validateRequest(token, signature, url, params);
}

function normalizeNumber(n: string | undefined): string {
  return (n ?? "").replace(/^whatsapp:/, "").trim();
}

/** Which firm does this inbound Twilio request belong to? Routed by To. */
export async function firmForTwilioNumber(to: string | undefined): Promise<FirmRow | null> {
  const number = normalizeNumber(to);
  if (!number) return null;
  const db = await getDb();
  const rows = await db
    .select()
    .from(tables.firms)
    .where(eq(tables.firms.twilioNumber, number))
    .limit(1);
  return rows[0] ?? null;
}

export async function handleInboundSms(
  firm: FirmRow,
  params: Record<string, string>
): Promise<void> {
  const isWhatsApp = params.From?.startsWith("whatsapp:");
  await ingestLead({
    firmId: firm.id,
    channel: isWhatsApp ? "whatsapp" : "sms",
    externalId: params.MessageSid,
    fromAddress: normalizeNumber(params.From),
    displayName: params.ProfileName ?? null,
    raw: params.Body ?? "",
    meta: {
      numMedia: params.NumMedia ? Number(params.NumMedia) : 0,
      city: params.FromCity,
      state: params.FromState,
    },
  });
}

/** TwiML for an incoming call: after-hours greeting, then record a voicemail. */
export function voicemailTwiml(firmName: string): string {
  const greeting =
    `You've reached the intake line at ${firmName}. ` +
    `We're sorry we missed you. Please leave your name, a callback number, and ` +
    `what happened, and a member of our team will call you back. ` +
    `Your message is reviewed by a person before anything else happens.`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${greeting}</Say>
  <Record maxLength="180" playBeep="true"
    transcribe="true" transcribeCallback="/api/inbound/twilio/transcription"
    action="/api/inbound/twilio/voice-complete" />
</Response>`;
}

/** Transcription callback: this is where the voicemail becomes a lead. */
export async function handleTranscription(
  firm: FirmRow,
  params: Record<string, string>
): Promise<void> {
  const text =
    params.TranscriptionStatus === "completed" && params.TranscriptionText
      ? params.TranscriptionText
      : "(Automatic transcription was unavailable for this voicemail — listen to the recording.)";
  await ingestLead({
    firmId: firm.id,
    channel: "voicemail",
    externalId: params.CallSid,
    fromAddress: normalizeNumber(params.From ?? params.Caller) || "unknown caller",
    raw: text,
    meta: {
      recordingUrl: params.RecordingUrl,
      recordingSid: params.RecordingSid,
      transcriptionStatus: params.TranscriptionStatus,
    },
  });
}

/**
 * Safety net: enqueued when the recording completes. If Twilio's transcription
 * callback never arrives (outage, unsupported language), the voicemail still
 * becomes a lead instead of vanishing.
 */
export async function runTranscribeVoicemail(payload: {
  firmId: number;
  callSid: string;
  recordingUrl: string;
  from?: string;
  durationSec?: number;
}): Promise<void> {
  const db = await getDb();
  const existing = await db
    .select({ id: tables.leads.id })
    .from(tables.leads)
    .where(
      and(eq(tables.leads.channel, "voicemail"), eq(tables.leads.externalId, payload.callSid))
    )
    .limit(1);
  if (existing[0]) return; // transcription callback already created it

  await ingestLead({
    firmId: payload.firmId,
    channel: "voicemail",
    externalId: payload.callSid,
    fromAddress: payload.from ?? "unknown caller",
    raw: "(Automatic transcription was unavailable for this voicemail — listen to the recording.)",
    meta: {
      recordingUrl: payload.recordingUrl,
      durationSec: payload.durationSec,
      transcriptionStatus: "missing",
    },
  });
}
