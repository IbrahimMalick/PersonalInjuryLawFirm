import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ingestLead } from "@/lib/channels/inbound";
import { getDb, tables } from "@/lib/db";

export const dynamic = "force-dynamic";

// SendGrid Inbound Parse posts multipart form data here. The URL carries the
// FIRM'S token (?token=...) — each firm gets its own, shown in Settings, so
// the token both authenticates the webhook and routes to the tenant.

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return new NextResponse("forbidden", { status: 403 });

  const db = await getDb();
  const firm = (
    await db
      .select()
      .from(tables.firms)
      .where(eq(tables.firms.emailInboundToken, token))
      .limit(1)
  )[0];
  if (!firm) return new NextResponse("forbidden", { status: 403 });

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

  const headers = get("headers");
  const messageId = headers.match(/^Message-ID:\s*<([^>]+)>/im)?.[1];

  await ingestLead({
    firmId: firm.id,
    channel: "email",
    externalId: messageId,
    fromAddress,
    displayName,
    raw: text.slice(0, 20_000),
    meta: { subject, attachments: Number(get("attachments") || 0) },
  });

  return NextResponse.json({ ok: true });
}
