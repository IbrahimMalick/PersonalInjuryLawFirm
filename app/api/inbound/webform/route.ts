import { NextResponse } from "next/server";
import { ingestLead } from "@/lib/channels/inbound";

export const dynamic = "force-dynamic";

// Public endpoint for the hosted intake form and the embeddable snippet.
// Spam defenses: honeypot field, minimum-fill-time check, per-IP rate limit.

const rate = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rate.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rate.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const wantsRedirect = new URL(request.url).searchParams.get("redirect") === "1";
  const done = () =>
    wantsRedirect
      ? NextResponse.redirect(new URL("/intake?sent=1", request.url), 303)
      : NextResponse.json({ ok: true });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many submissions" }, { status: 429 });
  }

  let fields: Record<string, string>;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    fields = (await request.json()) as Record<string, string>;
  } else {
    const form = await request.formData();
    fields = {};
    form.forEach((v, k) => {
      if (typeof v === "string") fields[k] = v;
    });
  }

  // Honeypot: a visually hidden field real people never fill.
  if (fields.website) {
    return done(); // pretend success; drop silently
  }
  // Minimum fill time: the form stamps when it rendered.
  const renderedAt = Number(fields._renderedAt ?? 0);
  if (renderedAt && Date.now() - renderedAt < 2000) {
    return done();
  }

  const firstName = (fields.firstName ?? "").trim().slice(0, 100);
  const lastName = (fields.lastName ?? "").trim().slice(0, 100);
  const phone = (fields.phone ?? "").trim().slice(0, 40);
  const email = (fields.email ?? "").trim().slice(0, 200);
  const message = (fields.message ?? "").trim().slice(0, 10_000);

  if (!message && !firstName && !phone && !email) {
    return NextResponse.json({ error: "Empty submission" }, { status: 400 });
  }

  const raw = [
    `First name: ${firstName || "(blank)"}`,
    `Last name: ${lastName || "(blank)"}`,
    `Phone: ${phone || "(blank)"}`,
    `Email: ${email || "(blank)"}`,
    `How can we help?: ${message || "(blank)"}`,
  ].join("\n");

  await ingestLead({
    channel: "webform",
    fromAddress: email || phone || "webform",
    displayName: [firstName, lastName].filter(Boolean).join(" ") || null,
    raw,
    meta: {
      formFields: {
        "First name": firstName,
        "Last name": lastName,
        Phone: phone,
        Email: email,
        "How can we help?": message,
      },
      ip,
    },
  });

  return done();
}
