// Platform email (verification, password reset) via SendGrid. Without a key,
// falls back to logging the link on the server console — dev and pre-SendGrid
// environments keep working, visibly.

export async function sendPlatformEmail(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!key || !from) {
    console.warn(`[email] SendGrid not configured — email to ${to} (${subject}):\n${body}`);
    return;
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
  }
}

export function baseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
}
