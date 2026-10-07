// Cloudflare Turnstile for the public intake form — free, no account tier
// required. Optional, same pattern as every other integration here (Stripe,
// Twilio, GHL): until TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY are both
// set, the widget never renders and the server never asks for a token, so
// nothing changes from today's behavior (honeypot + fill-time + the shared
// rate limiter only).
//
// Tradeoff worth knowing before turning this on: the intake form is built to
// work with JavaScript off (see app/intake/[slug]/page.tsx). Turnstile's
// widget requires JS to produce a token, so once this is configured, a
// no-JS submission can no longer pass verification — that's inherent to any
// CAPTCHA, not something this implementation can avoid.

export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY || null;
}

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

/** Verifies a widget token with Cloudflare. Fails closed: any error, timeout,
 * or missing token is treated as a failed check, never silently allowed. */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (e) {
    console.error(`[turnstile] verification request failed: ${(e as Error).message}`);
    return false;
  }
}
