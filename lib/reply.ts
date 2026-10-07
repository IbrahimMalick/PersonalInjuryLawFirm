import type { LeadRow } from "./db/schema";
import { contactOf, type AnyCaseFile } from "./casefile";

// Where does the approved reply actually go? Prefer the contact details the
// model extracted (a voicemail's spoken-aloud number beats caller ID);
// fall back to the channel's own address.

export interface ReplyDestination {
  channel: "sms" | "voicemail" | "whatsapp" | "email" | "webform";
  to: string;
  describe: string; // human label for the review screen
  // True when `to` is the model's extraction AND it disagrees with the
  // channel's own verified address (Twilio's caller ID, the parsed email
  // From). Extracted free text is attacker-reachable — a lead can ask to
  // be reached at a different number or address than it actually came
  // from — so when the model's answer overrides a verified one instead of
  // just filling in a gap, the review screen says so.
  mismatch: boolean;
}

function looksLikeEmail(s: string): boolean {
  return /.+@.+\..+/.test(s);
}

function looksLikePhone(s: string): boolean {
  return /[\d()+\-\s]{7,}/.test(s) && !looksLikeEmail(s);
}

/** Digits only, and a leading US country code dropped, so "+1 (347) 555-0119"
 * and "3475550119" compare equal instead of flagging a false mismatch. */
function normalizePhone(s: string): string {
  const digits = s.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function phonesDiffer(a: string, b: string): boolean {
  return normalizePhone(a) !== normalizePhone(b);
}

function emailsDiffer(a: string, b: string): boolean {
  return a.trim().toLowerCase() !== b.trim().toLowerCase();
}

export function resolveReplyDestination(lead: LeadRow, cf: AnyCaseFile): ReplyDestination | null {
  const { phone: extractedPhone, email: extractedEmail } = contactOf(cf);
  const channelPhone = looksLikePhone(lead.fromAddress) ? lead.fromAddress : null;
  const channelEmail = looksLikeEmail(lead.fromAddress) ? lead.fromAddress : null;

  switch (lead.channel) {
    case "sms":
    case "voicemail": {
      const to = extractedPhone ?? channelPhone;
      if (!to) return null;
      const mismatch = Boolean(extractedPhone && channelPhone && phonesDiffer(extractedPhone, channelPhone));
      return { channel: lead.channel, to, describe: `Text message to ${to}`, mismatch };
    }
    case "whatsapp": {
      const to = extractedPhone ?? channelPhone;
      if (!to) return null;
      const mismatch = Boolean(extractedPhone && channelPhone && phonesDiffer(extractedPhone, channelPhone));
      return { channel: "whatsapp", to, describe: `WhatsApp to ${to}`, mismatch };
    }
    case "email": {
      const to = extractedEmail ?? channelEmail;
      if (!to) return null;
      const mismatch = Boolean(extractedEmail && channelEmail && emailsDiffer(extractedEmail, channelEmail));
      return { channel: "email", to, describe: `Email to ${to}`, mismatch };
    }
    case "webform": {
      const email = extractedEmail ?? channelEmail;
      if (email) {
        const mismatch = Boolean(extractedEmail && channelEmail && emailsDiffer(extractedEmail, channelEmail));
        return { channel: "webform", to: email, describe: `Email to ${email}`, mismatch };
      }
      const phone = extractedPhone ?? channelPhone;
      if (phone) {
        const mismatch = Boolean(extractedPhone && channelPhone && phonesDiffer(extractedPhone, channelPhone));
        return { channel: "sms", to: phone, describe: `Text message to ${phone}`, mismatch };
      }
      return null;
    }
    default:
      return null;
  }
}
