import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { apiUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { firmBillingState } from "@/lib/billing";
import { getFirmById } from "@/lib/firm";
import { disclaimerFor } from "@/lib/guardrails";
import { enqueue } from "@/lib/queue";
import { resolveReplyDestination } from "@/lib/reply";
import type { CaseFile } from "@/lib/schema";

export const dynamic = "force-dynamic";

// A human approving a reply. The body may have been edited — that edit is
// itself audited. Conflict-flagged leads require an admin.

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Verify your email before sending replies — check your inbox for the link" },
      { status: 403 }
    );
  }
  const { id } = await ctx.params;
  const { body } = (await request.json()) as { body?: string };
  if (!body?.trim()) return NextResponse.json({ error: "Reply body is empty" }, { status: 400 });

  const db = await getDb();
  const lead = (await db.select().from(tables.leads).where(eq(tables.leads.id, id)).limit(1))[0];
  if (!lead || lead.firmId !== user.firmId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (lead.status !== "triaged" || !lead.caseFile) {
    return NextResponse.json({ error: "Lead is not ready for review" }, { status: 409 });
  }
  const cf = lead.caseFile as unknown as CaseFile;

  if (cf.conflictFlags.length > 0 && user.role !== "admin") {
    return NextResponse.json(
      { error: "Conflict hold: only an administrator can release this reply" },
      { status: 403 }
    );
  }

  const existing = await db
    .select({ id: tables.messages.id })
    .from(tables.messages)
    .where(eq(tables.messages.leadId, id))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "A reply was already approved for this inquiry" }, { status: 409 });
  }

  const destination = resolveReplyDestination(lead, cf);
  if (!destination) {
    return NextResponse.json(
      { error: "No reachable address — this inquiry has no usable phone or email" },
      { status: 422 }
    );
  }

  const firm = await getFirmById(user.firmId);
  if (!firm) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (firmBillingState(firm).kind === "blocked") {
    return NextResponse.json(
      { error: "Trial ended — subscribe under Settings → Billing to resume sending" },
      { status: 403 }
    );
  }
  const finalBody =
    body.trim() + "\n\n" + disclaimerFor(cf.claimant.preferredLanguage, firm.name);

  const edited = body.trim() !== (lead.draftReply ?? "").trim();
  if (edited) {
    await audit("reply.edited", { firmId: firm.id, leadId: id, userId: user.id });
  }

  const inserted = await db
    .insert(tables.messages)
    .values({
      firmId: firm.id,
      leadId: id,
      channel: destination.channel,
      toAddress: destination.to,
      body: finalBody,
      approvedBy: user.id,
    })
    .returning({ id: tables.messages.id });

  await db
    .update(tables.leads)
    .set({ reviewedBy: user.id, reviewedAt: new Date().toISOString() })
    .where(eq(tables.leads.id, id));

  await audit("reply.approved", {
    firmId: firm.id,
    leadId: id,
    userId: user.id,
    detail: { messageId: inserted[0].id, to: destination.to, channel: destination.channel, edited },
  });
  await enqueue("send_message", { messageId: inserted[0].id });

  return NextResponse.json({ ok: true, messageId: inserted[0].id });
}
