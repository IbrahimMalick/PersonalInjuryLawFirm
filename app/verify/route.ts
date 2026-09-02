import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { redeemToken } from "@/lib/auth-tokens";
import { getDb, tables } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const userId = token ? await redeemToken(token, "verify_email") : null;
  if (!userId) {
    return NextResponse.redirect(new URL("/login?verify=invalid", request.url));
  }
  const db = await getDb();
  const rows = await db
    .update(tables.users)
    .set({ emailVerifiedAt: new Date().toISOString() })
    .where(eq(tables.users.id, userId))
    .returning({ firmId: tables.users.firmId });
  await audit("user.email_verified", { firmId: rows[0]?.firmId, userId });
  return NextResponse.redirect(new URL("/?verified=1", request.url));
}
