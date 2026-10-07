import { and, count, eq, lt } from "drizzle-orm";
import { getDb, tables } from "./db";

// Shared, persistent rate limiting — a plain Postgres table (lib/db/schema.ts
// rateLimitHits), not an in-memory Map. A module-scope Map only limits
// requests landing on the SAME warm serverless instance; on Vercel every
// cold start gets a fresh, empty Map, so it never actually binds once there's
// real concurrent traffic. This does, because every instance reads and
// writes the same table.
//
// `scope` is the caller's own key (e.g. "webform:<firmId>:<ip>",
// "signup:<ip>") — one table, many independent limits.

/**
 * True if `scope` has already hit `max` attempts within `windowMs`. Counting
 * a hit (when not limited) and pruning anything older than the window both
 * happen here, scoped to this one key — cheap, and keeps the table from
 * growing unbounded without a separate cleanup job.
 */
export async function rateLimited(
  scope: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const db = await getDb();
  const since = new Date(Date.now() - windowMs).toISOString();

  await db
    .delete(tables.rateLimitHits)
    .where(and(eq(tables.rateLimitHits.scope, scope), lt(tables.rateLimitHits.createdAt, since)));

  const [row] = await db
    .select({ n: count() })
    .from(tables.rateLimitHits)
    .where(eq(tables.rateLimitHits.scope, scope));

  if ((row?.n ?? 0) >= max) return true;

  await db.insert(tables.rateLimitHits).values({ scope });
  return false;
}
