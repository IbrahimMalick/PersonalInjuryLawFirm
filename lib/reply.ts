import type { LeadRow } from "./db/schema";
import type { CaseFile } from "./schema";

// Where does the approved reply actually go? Prefer the contact details the
// model extracted (a voicemail's spoken-aloud number beats caller ID);
// fall back to the channel's own address.

export interface ReplyDestination {
  channel: "sms" | "voicemail" | "whatsapp" | "email" | "webform";
  to: string;
  describe: string; // human label for the review screen
}

function looksLikeEmail(s: string): boolean {
  return /.+@.+\..+/.test(s);
}

function looksLikePhone(s: string): boolean {
  return /[\d()+\-\s]{7,}/.test(s) && !looksLikeEmail(s);
}

export function resolveReplyDestination(lead: LeadRow, cf: CaseFile): ReplyDestination | null {
  const extractedPhone = cf.claimant.phone;
  const extractedEmail = cf.claimant.email;
  const channelPhone = looksLikePhone(lead.fromAddress) ? lead.fromAddress : null;
  const channelEmail = looksLikeEmail(lead.fromAddress) ? lead.fromAddress : null;

  switch (lead.channel) {
    case "sms":
    case "voicemail": {
      const to = extractedPhone ?? channelPhone;
      return to
        ? { channel: lead.channel, to, describe: `Text message to ${to}` }
        : null;
    }
    case "whatsapp": {
      const to = extractedPhone ?? channelPhone;
      return to ? { channel: "whatsapp", to, describe: `WhatsApp to ${to}` } : null;
    }
    case "email": {
      const to = extractedEmail ?? channelEmail;
      return to ? { channel: "email", to, describe: `Email to ${to}` } : null;
    }
    case "webform": {
      const email = extractedEmail ?? channelEmail;
      if (email) return { channel: "webform", to: email, describe: `Email to ${email}` };
      const phone = extractedPhone ?? channelPhone;
      if (phone) return { channel: "sms", to: phone, describe: `Text message to ${phone}` };
      return null;
    }
    default:
      return null;
  }
}
