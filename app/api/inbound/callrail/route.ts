import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ingestLead } from "@/lib/channels/inbound";
import { getDb, tables } from "@/lib/db";
import {
  callrailSecretFrom,
  mapCallRailCall,
  verifyCallRailSignature,
  type CallRailCall,
} from "@/lib/integrations/callrail";

export const dynamic = "force-dynamic";

// CallRail post-call webhook. The URL carries the firm's inbound token
// (?token=..., the same per-firm token as email inbound) for routing; when the
// firm has stored CallRail's signing secret, the x-callrail-signature HMAC is
// verified on top and unsigned posts are rejected.

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

  const rawBody = await request.text();

  const integration = (
    await db
      .select()
      .from(tables.integrations)
      .where(
        and(
          eq(tables.integrations.firmId, firm.id),
          eq(tables.integrations.provider, "callrail")
        )
      )
      .limit(1)
  )[0];
  const secret = integration ? callrailSecretFrom(integration.config) : null;
  if (secret) {
    const ok = verifyCallRailSignature(
      rawBody,
      request.headers.get("x-callrail-signature"),
      secret
    );
    if (!ok) return new NextResponse("bad signature", { status: 403 });
  }

  let call: CallRailCall;
  try {
    call = JSON.parse(rawBody) as CallRailCall;
  } catch {
    return new NextResponse("bad payload", { status: 400 });
  }

  const inbound = mapCallRailCall(firm.id, call);
  if (!inbound) return NextResponse.json({ ok: true, skipped: "no caller number" });

  const { leadId, duplicate } = await ingestLead(inbound);
  if (integration) {
    await db
      .update(tables.integrations)
      .set({ lastSyncAt: new Date().toISOString(), lastError: null })
      .where(eq(tables.integrations.id, integration.id));
  }
  return NextResponse.json({ ok: true, leadId, duplicate });
}
