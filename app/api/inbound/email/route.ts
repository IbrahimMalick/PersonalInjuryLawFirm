import { NextResponse } from "next/server";
import { ingestLead } from "@/lib/channels/inbound";

export const dynamic = "force-dynamic";

// SendGrid Inbound Parse posts multipart form data here. The URL carries a
// shared secret (?token=...) — configure the same value in SendGrid and in
// EMAIL_INBOUND_TOKEN. Requests without it are rejected.

export async function POST(request: Request) {
  const token = process.env.EMAIL_INBOUND_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Email intake not configured" }, { status: 503 });
  }
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== token) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const form = await request.formData();
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };

  const fromHeader = get("from"); // e.g. `Jane Doe <jane@x.com>`
  const match = fromHeader.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/);
  const displayName = match?.[1]?.trim() || null;
  const fromAddress = match?.[2]?.trim() || fromHeader.trim() || "unknown sender";
  const subject = get("subject");
  const text = get("text") || get("html").replace(/<[^>]+>/g, " ");

  // Message-ID header for idempotency when available.
  const headers = get("headers");
  const messageId = headers.match(/^Message-ID:\s*<([^>]+)>/im)?.[1];

  await ingestLead({
    channel: "email",
    externalId: messageId,
    fromAddress,
    displayName,
    raw: text.slice(0, 20_000),
    meta: { subject, attachments: Number(get("attachments") || 0) },
  });

  return NextResponse.json({ ok: true });
}
