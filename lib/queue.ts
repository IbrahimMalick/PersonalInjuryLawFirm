import { eq, sql } from "drizzle-orm";
import { getDb, tables } from "./db";
import type { JobRow } from "./db/schema";

// Postgres-backed job queue. Claims are atomic (FOR UPDATE SKIP LOCKED), so
// the long-running worker (Docker) and concurrent serverless drains (Vercel
// after() + cron) can coexist without double-processing. Jobs survive
// restarts, fail with exponential backoff, and go "dead" after maxAttempts.

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
  kickQueueSoon();
  return rows[0].id;
}

// On serverless (Vercel), process the queue right after the response is sent —
// leads triage in seconds, not at the next cron tick. Outside a request scope
// (the worker itself enqueuing) after() throws; that's fine — the worker loop
// or the cron sweeper picks the job up.
function kickQueueSoon(): void {
  if (!process.env.VERCEL) return; // long-running deployments have the worker
  import("next/server")
    .then(({ after }) => {
      after(async () => {
        const { drainJobs } = await import("./worker");
        await drainJobs(5);
      });
    })
    .catch(() => {});
}

/** Atomically claim the next runnable job (safe under concurrency). */
export async function claimNext(): Promise<JobRow | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.execute(sql`
    UPDATE jobs SET status = 'running', started_at = ${now}, attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending' AND run_at <= ${now}
      ORDER BY run_at, id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  const rows = (result as unknown as { rows?: { id: number }[] }).rows ?? [];
  if (!rows[0]) return null;
  const claimed = await db
    .select()
    .from(tables.jobs)
    .where(eq(tables.jobs.id, rows[0].id))
    .limit(1);
  return claimed[0] ?? null;
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
  const attempts = job.attempts; // claimNext already incremented the row
  const dead = attempts >= job.maxAttempts;
  const backoffSeconds = Math.min(600, 30 * 2 ** Math.max(0, attempts - 1));
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

/** Recover jobs stuck in "running" after a crash (visibility timeout). */
export async function recoverStuckJobs(olderThanMinutes = 10): Promise<void> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  await db.execute(sql`
    UPDATE jobs SET status = 'pending', run_at = ${new Date().toISOString()}
    WHERE status = 'running' AND started_at <= ${cutoff}
  `);
}
