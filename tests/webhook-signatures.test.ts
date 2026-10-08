import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Pre-Launch Audit process gap: "not one test asserting... that a webhook
// rejects a bad signature." Twilio and Stripe are the two signed webhooks
// in this codebase; both must fail closed on a missing or wrong signature.
// Neither route touches cookies/next-headers, so these call the real
// exported route handlers directly, no mocking needed.

const ENV_KEYS = [
  "TWILIO_AUTH_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("Twilio inbound SMS — signature verification", () => {
  it("rejects a request with no signature header, even with a token configured", async () => {
    process.env.TWILIO_AUTH_TOKEN = "fake-auth-token";
    const { POST } = await import("../app/api/inbound/twilio/sms/route");
    const body = new URLSearchParams({ From: "+15550001111", To: "+15559999999", Body: "hi" });
    const req = new Request("https://example.test/api/inbound/twilio/sms", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rejects a request with a wrong signature", async () => {
    process.env.TWILIO_AUTH_TOKEN = "fake-auth-token";
    const { POST } = await import("../app/api/inbound/twilio/sms/route");
    const body = new URLSearchParams({ From: "+15550001111", To: "+15559999999", Body: "hi" });
    const req = new Request("https://example.test/api/inbound/twilio/sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Twilio-Signature": "totally-not-a-real-signature",
      },
      body: body.toString(),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rejects every request when no Twilio auth token is configured at all", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    const { POST } = await import("../app/api/inbound/twilio/sms/route");
    const req = new Request("https://example.test/api/inbound/twilio/sms", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "From=%2B15550001111&To=%2B15559999999&Body=hi",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

describe("Stripe webhook — signature verification", () => {
  function configureBilling() {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_PRICE_ID = "price_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
  }

  it("rejects a request with no stripe-signature header", async () => {
    configureBilling();
    const { POST } = await import("../app/api/stripe/webhook/route");
    const req = new Request("https://example.test/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/missing signature/i);
  });

  it("rejects a request with a garbage signature", async () => {
    configureBilling();
    const { POST } = await import("../app/api/stripe/webhook/route");
    const req = new Request("https://example.test/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=not-a-real-signature" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/invalid signature/i);
  });

  it("refuses to process anything when billing isn't configured, before even checking a signature", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import("../app/api/stripe/webhook/route");
    const req = new Request("https://example.test/api/stripe/webhook", { method: "POST", body: "{}" });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });
});
