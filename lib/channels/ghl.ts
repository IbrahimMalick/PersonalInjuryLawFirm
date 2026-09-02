// GoHighLevel (LeadConnector API v2) email sender. Active when EMAIL_PROVIDER=ghl.
//
// GHL has no plain transactional-send endpoint: email goes to a *contact* inside
// a *conversation*. So every send upserts the recipient as a contact in the
// location, then posts an Email message. Sent mail shows up in that contact's
// conversation thread in GHL.
//
// Env:
//   GHL_API_TOKEN     Private Integration token (pit-...), scopes: contacts.write,
//                     contacts.readonly, conversations.write,
//                     conversations/message.write, conversations/message.readonly
//   GHL_LOCATION_ID   the sub-account id
//   GHL_EMAIL_FROM    a from address on a domain verified in that location's
//                     Email Services (e.g. intake@thedigitaltutor.net), optionally
//                     "Display Name <intake@thedigitaltutor.net>"

const API = "https://services.leadconnectorhq.com";

export function ghlConfigured(): boolean {
  return Boolean(
    process.env.GHL_API_TOKEN && process.env.GHL_LOCATION_ID && process.env.GHL_EMAIL_FROM
  );
}

export interface GhlSendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

function headers(version: string): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: version,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return (
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;` +
    `font-size:15px;line-height:1.55;white-space:pre-wrap">${escaped}</div>`
  );
}

/** Upsert the recipient as a contact in the location; returns the contact id. */
async function upsertContact(email: string, name?: string): Promise<string> {
  const res = await fetch(`${API}/contacts/upsert`, {
    method: "POST",
    headers: headers("2021-07-28"),
    body: JSON.stringify({
      locationId: process.env.GHL_LOCATION_ID,
      email,
      ...(name ? { name } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`contacts/upsert ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { contact?: { id?: string } };
  const id = data.contact?.id;
  if (!id) throw new Error("contacts/upsert returned no contact id");
  return id;
}

/**
 * Send one email through GHL. Never throws — returns {ok:false, error} so callers
 * (platform email, outbound reply) can log or mark "failed" as they prefer.
 */
export async function ghlSendEmail(
  to: string,
  subject: string,
  text: string,
  opts: { toName?: string } = {}
): Promise<GhlSendResult> {
  if (!ghlConfigured()) return { ok: false, error: "GHL email is not configured" };
  try {
    const contactId = await upsertContact(to, opts.toName);
    const res = await fetch(`${API}/conversations/messages`, {
      method: "POST",
      headers: headers("2021-04-15"),
      body: JSON.stringify({
        type: "Email",
        contactId,
        emailFrom: process.env.GHL_EMAIL_FROM,
        subject,
        html: textToHtml(text),
        message: text,
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `conversations/messages ${res.status}: ${(await res.text()).slice(0, 300)}`,
      };
    }
    const data = (await res.json()) as {
      messageId?: string;
      emailMessageId?: string;
      conversationId?: string;
    };
    return { ok: true, providerId: data.emailMessageId ?? data.messageId ?? data.conversationId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
