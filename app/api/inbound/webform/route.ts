import { NextResponse } from "next/server";
import { uploadAttachments } from "@/lib/blob";
import { ingestLead } from "@/lib/channels/inbound";
import { getFirmBySlug } from "@/lib/firm";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // room for a few file uploads

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
  const url = new URL(request.url);
  const wantsRedirect = url.searchParams.get("redirect") === "1";
  const slug = url.searchParams.get("firm") ?? "";
  const lang = url.searchParams.get("lang") === "es" ? "es" : null;
  const firm = await getFirmBySlug(slug);
  if (!firm) return NextResponse.json({ error: "Unknown firm" }, { status: 404 });
  const done = () =>
    wantsRedirect
      ? NextResponse.redirect(
          new URL(`/intake/${firm.slug}?sent=1${lang ? `&lang=${lang}` : ""}`, request.url),
          303
        )
      : NextResponse.json({ ok: true });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(`${firm.id}:${ip}`)) {
    return NextResponse.json({ error: "Too many submissions" }, { status: 429 });
  }

  let fields: Record<string, string>;
  const attachmentFiles: File[] = [];
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    fields = (await request.json()) as Record<string, string>;
  } else {
    const form = await request.formData();
    fields = {};
    form.forEach((v, k) => {
      if (typeof v === "string") fields[k] = v;
      else if (k === "attachments" && v.size > 0) attachmentFiles.push(v);
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

  const { urls: attachments } = await uploadAttachments(attachmentFiles, `intake/${firm.slug}`);

  // Immigration firms' form has three extra optional fields. They are appended
  // to the text the model reads AND kept as formFields — the "someone is
  // detained" answer is also handed to code as a backstop (lib/pipeline.ts).
  const extraLines: string[] = [];
  const extraFields: Record<string, string> = {};
  if (firm.practiceArea === "immigration") {
    const country = (fields.country ?? "").trim().slice(0, 100);
    const detainedRaw = (fields.detained ?? "").trim().toLowerCase();
    const keyDateRaw = (fields.keyDate ?? "").trim();
    const detained =
      detainedRaw === "yes"
        ? "Yes"
        : detainedRaw === "no"
          ? "No"
          : detainedRaw === "unsure"
            ? "Not sure"
            : "";
    const keyDate = /^\d{4}-\d{2}-\d{2}$/.test(keyDateRaw) ? keyDateRaw : "";
    if (country) {
      extraLines.push(`Country of citizenship: ${country}`);
      extraFields["Country of citizenship"] = country;
    }
    if (detained) {
      // Worded as the question the form actually asks, so the model doesn't
      // read a "Yes" as "the sender is detained" — it means someone is.
      extraLines.push(`Is anyone currently detained? (form question, answered by sender): ${detained}`);
      extraFields["Currently detained"] = detained;
    }
    if (keyDate) {
      extraLines.push(`Upcoming hearing or notice deadline (as given by sender): ${keyDate}`);
      extraFields["Upcoming hearing or notice deadline"] = keyDate;
    }
  }

  const raw = [
    `First name: ${firstName || "(blank)"}`,
    `Last name: ${lastName || "(blank)"}`,
    `Phone: ${phone || "(blank)"}`,
    `Email: ${email || "(blank)"}`,
    `How can we help?: ${message || "(blank)"}`,
    ...extraLines,
  ].join("\n");

  await ingestLead({
    firmId: firm.id,
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
        ...extraFields,
      },
      ip,
      ...(attachments.length > 0 ? { attachments } : {}),
    },
  });

  return done();
}
