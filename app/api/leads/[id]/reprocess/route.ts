import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { apiUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { enqueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  const lead = (await db.select().from(tables.leads).where(eq(tables.leads.id, id)).limit(1))[0];
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (lead.status === "archived") {
    return NextResponse.json({ error: "Archived leads can't be reprocessed" }, { status: 409 });
  }
  await db
    .update(tables.leads)
    .set({ status: "received", processingError: null })
    .where(eq(tables.leads.id, id));
  await audit("lead.reprocess_requested", { leadId: id, userId: user.id });
  await enqueue("process_lead", { leadId: id });
  return NextResponse.json({ ok: true });
}
