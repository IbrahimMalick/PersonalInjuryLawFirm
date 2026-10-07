import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Public, unauthenticated, intentionally trivial — an external uptime monitor
// (UptimeRobot, Better Stack, Pingdom, …) hits this on a schedule and pages
// someone the moment it stops answering. The whole pitch is "we never miss a
// call"; before this route existed, if Nightshift itself went down at 3 AM,
// the first anyone heard about it was a firm calling to ask why.
//
// Checks the one dependency that actually matters for serving a request: can
// this process reach its own database. Not a deep check (job-queue backlog,
// outbound provider reachability, …) on purpose — a health check that can
// itself flake or time out defeats the point.

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch (e) {
    // Logged server-side only — this route is public and unauthenticated, so
    // the raw error (which can include connection details) never goes in the
    // response body. The uptime monitor only needs ok:false to page someone.
    console.error("[health] check failed:", (e as Error).message);
    return NextResponse.json({ ok: false, time: new Date().toISOString() }, { status: 503 });
  }
}
