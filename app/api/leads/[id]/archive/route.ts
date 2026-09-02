import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { apiUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  const lead = (await db.select().from(tables.leads).where(eq(tables.leads.id, id)).limit(1))[0];
  if (!lead || lead.firmId !== user.firmId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.update(tables.leads).set({ status: "archived" }).where(eq(tables.leads.id, id));
  await audit("lead.archived", { firmId: lead.firmId, leadId: id, userId: user.id });
  return NextResponse.json({ ok: true });
}
