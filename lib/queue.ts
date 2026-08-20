import { and, asc, eq, lte, sql } from "drizzle-orm";
import { getDb, tables } from "./db";
import type { JobRow } from "./db/schema";

// DB-backed job queue. Single worker per instance (instance-per-firm volumes
// are small); jobs survive restarts, fail with exponential backoff, and go
// "dead" after maxAttempts so a human can see what needs attention.

export type JobType = "process_lead" | "send_message" | "transcribe_voicemail";

export async function enqueue(
  type: JobType,
  payload: Record<string, unknown>,
  opts: { delaySeconds?: number; maxAttempts?: number } = {}
): Promise<number> {
  const db = await getDb();
  const runAt = new Date(Date.now() + (opts.delaySeconds ?? 0) * 1000).toISOString();
  const defaultMax = Number(process.env.NIGHTSHIFT_JOB_MAX_ATTEMPTS ?? 4);
  const rows = await db
    .insert(tables.jobs)
    .values({ type, payload, runAt, maxAttempts: opts.maxAttempts ?? defaultMax })
    .returning({ id: tables.jobs.id });
  return rows[0].id;
}

/** Claim the next runnable job. Single-worker, so a plain select+update is safe. */
export async function claimNext(): Promise<JobRow | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  const candidates = await db
    .select()
    .from(tables.jobs)
    .where(and(eq(tables.jobs.status, "pending"), lte(tables.jobs.runAt, now)))
    .orderBy(asc(tables.jobs.runAt), asc(tables.jobs.id))
    .limit(1);
  const job = candidates[0];
  if (!job) return null;
  const updated = await db
    .update(tables.jobs)
    .set({
      status: "running",
      startedAt: now,
      attempts: sql`${tables.jobs.attempts} + 1`,
    })
    .where(and(eq(tables.jobs.id, job.id), eq(tables.jobs.status, "pending")))
    .returning();
  return updated[0] ?? null;
}

export async function completeJob(id: number): Promise<void> {
  const db = await getDb();
  await db
    .update(tables.jobs)
    .set({ status: "done", finishedAt: new Date().toISOString() })
    .where(eq(tables.jobs.id, id));
}

/** Returns true if the job is now dead (no more retries). */
export async function failJob(job: JobRow, error: Error): Promise<boolean> {
  const db = await getDb();
  const attempts = job.attempts + 1; // claimNext already incremented the row
  const dead = attempts >= job.maxAttempts;
  const backoffSeconds = Math.min(600, 30 * 2 ** (attempts - 1)); // 30s, 60s, 120s… cap 10m
  await db
    .update(tables.jobs)
    .set({
      status: dead ? "dead" : "pending",
      lastError: String(error.message ?? error).slice(0, 2000),
      runAt: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
      finishedAt: dead ? new Date().toISOString() : null,
    })
    .where(eq(tables.jobs.id, job.id));
  return dead;
}

/** Recover jobs stuck in "running" after a crash/restart (visibility timeout). */
export async function recoverStuckJobs(olderThanMinutes = 10): Promise<void> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  await db
    .update(tables.jobs)
    .set({ status: "pending", runAt: new Date().toISOString() })
    .where(and(eq(tables.jobs.status, "running"), lte(tables.jobs.startedAt, cutoff)));
}
