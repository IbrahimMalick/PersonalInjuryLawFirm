import type { FirmRow, MessageRow } from "../db/schema";
import { ghlConfigured, ghlSendEmail } from "./ghl";

// Outbound senders. Each channel sends for real when its credentials are
// configured, and otherwise runs in SIMULATED mode: the message is marked
// `simulated` (visibly, in the UI and audit log) instead of pretending to
// send. That keeps the whole approve→send pipeline exercisable before the
// firm's Twilio/email accounts exist — without ever lying about delivery.

export interface SendOutcome {
  status: "sent" | "simulated" | "failed";
  providerId?: string;
  error?: string;
}

function twilioConfigured(fromNumber: string | null): fromNumber is string {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && fromNumber
  );
}

async function sendSms(
  fromNumber: string | null,
  to: string,
  body: string,
  whatsapp = false
): Promise<SendOutcome> {
  if (!twilioConfigured(fromNumber)) {
    console.warn(
      `[nightshift] Twilio not configured for this firm — SIMULATED ${whatsapp ? "WhatsApp" : "SMS"} to ${to}`
    );
    return { status: "simulated" };
  }
  const { default: twilio } = await import("twilio");
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const prefix = whatsapp ? "whatsapp:" : "";
  try {
    const message = await client.messages.create({
      from: `${prefix}${fromNumber}`,
      to: `${prefix}${to}`,
      body,
    });
    return { status: "sent", providerId: message.sid };
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
}

function emailConfigured(): boolean {
  if (process.env.EMAIL_PROVIDER === "ghl") return ghlConfigured();
  return Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM_ADDRESS);
}

async function sendEmail(to: string, body: string, subject: string): Promise<SendOutcome> {
  if (!emailConfigured()) {
    console.warn(`[nightshift] email provider not configured — SIMULATED email to ${to}`);
    return { status: "simulated" };
  }

  if (process.env.EMAIL_PROVIDER === "ghl") {
    const result = await ghlSendEmail(to, subject, body);
    return result.ok
      ? { status: "sent", providerId: result.providerId }
      : { status: "failed", error: result.error };
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.EMAIL_FROM_ADDRESS, name: process.env.EMAIL_FROM_NAME ?? "Intake" },
        subject,
        content: [{ type: "text/plain", value: body }],
      }),
    });
    if (res.status === 202) {
      return { status: "sent", providerId: res.headers.get("x-message-id") ?? undefined };
    }
    return { status: "failed", error: `SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}` };
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
}

export async function sendViaChannel(message: MessageRow, firm: FirmRow): Promise<SendOutcome> {
  const fromNumber = firm.twilioNumber ?? process.env.TWILIO_PHONE_NUMBER ?? null;
  switch (message.channel) {
    case "sms":
    case "voicemail": // reply to a voicemail goes back as SMS to the caller
      return sendSms(fromNumber, message.toAddress, message.body);
    case "whatsapp":
      return sendSms(fromNumber, message.toAddress, message.body, true);
    case "email":
    case "webform": // webform replies go to the email captured on the form
      return sendEmail(message.toAddress, message.body, "Following up on your inquiry");
    default:
      return { status: "failed", error: `No sender for channel ${message.channel}` };
  }
}

/** Channel configuration status for a firm's settings screen. */
export function channelStatus(firm: FirmRow) {
  return {
    twilio: twilioConfigured(firm.twilioNumber ?? process.env.TWILIO_PHONE_NUMBER ?? null),
    twilioNumber: firm.twilioNumber,
    email: emailConfigured(),
    webform: true, // always on — served by this app itself
  };
}
