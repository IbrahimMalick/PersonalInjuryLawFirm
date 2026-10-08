import { ghlConfigured, ghlSendEmail } from "./channels/ghl";

// Platform email (verification, password reset). Provider is chosen by
// EMAIL_PROVIDER:
//   "ghl"   → GoHighLevel LeadConnector API
//   unset / anything else → SendGrid
// Without a working provider it falls back to logging the link on the server
// console — dev and pre-provider environments keep working, visibly.

/**
 * Returns whether the email was actually handed to a real provider — never
 * throws. false covers "unconfigured" (logged to console only) exactly the
 * same as a provider error, because both mean nobody was actually emailed;
 * a caller that treats a resolved promise as success (like an alert's audit
 * trail) needs to be able to tell the difference from a genuine send.
 */
export async function sendPlatformEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  if (process.env.EMAIL_PROVIDER === "ghl") {
    if (!ghlConfigured()) {
      console.warn(
        `[email] EMAIL_PROVIDER=ghl but GHL_API_TOKEN / GHL_LOCATION_ID / GHL_EMAIL_FROM ` +
          `not all set — email to ${to} (${subject}):\n${body}`
      );
      return false;
    }
    const result = await ghlSendEmail(to, subject, body);
    if (!result.ok) {
      console.error(`[email] GHL send to ${to} failed: ${result.error}`);
      return false;
    }
    return true;
  }

  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!key || !from) {
    console.warn(`[email] SendGrid not configured — email to ${to} (${subject}):\n${body}`);
    return false;
  }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: process.env.EMAIL_FROM_NAME ?? "Nightshift" },
      subject,
      content: [{ type: "text/plain", value: body }],
    }),
  });
  if (res.status !== 202) {
    console.error(`[email] SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return false;
  }
  return true;
}

export function baseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
}
