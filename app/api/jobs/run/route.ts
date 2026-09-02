import { NextResponse } from "next/server";
import { recoverStuckJobs } from "@/lib/queue";
import { drainJobs } from "@/lib/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron sweeper for serverless deployments (see vercel.json). The after()
// kicks handle the instant path; this catches retries, backoffs, and anything
// a cold invocation dropped. Secured by CRON_SECRET (Vercel sends it as a
// Bearer token automatically when the env var is set).

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await recoverStuckJobs();
  const processed = await drainJobs(25);
  return NextResponse.json({ ok: true, processed });
}
