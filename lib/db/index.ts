import fs from "fs";
import path from "path";
import * as schema from "./schema";

// Postgres everywhere, two drivers:
//   - DATABASE_URL set  → node-postgres Pool (Neon / Supabase / RDS / Vercel
//     Postgres — anything that speaks the wire protocol). Production.
//   - DATABASE_URL unset → embedded PGlite persisted to ./data/pg (real
//     Postgres compiled to WASM, in-process). `npm run dev` needs zero setup.
// Same Drizzle schema, same migrations folder for both.

type AnyDb = import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema>;

declare global {
  var __nightshiftPg: { db: AnyDb; ready: Promise<void> | null } | undefined;
}

async function create(): Promise<{ db: AnyDb; migrate: () => Promise<void> }> {
  const url = process.env.DATABASE_URL;
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url, max: 5 });
    const db = drizzle(pool, { schema });
    return { db, migrate: () => migrate(db, { migrationsFolder }) };
  }

  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "pg");
  fs.mkdirSync(dataDir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema }) as unknown as AnyDb;
  return {
    db,
    migrate: () =>
      migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder }),
  };
}

export async function getDb(): Promise<AnyDb> {
  if (!globalThis.__nightshiftPg) {
    globalThis.__nightshiftPg = { db: undefined as unknown as AnyDb, ready: null };
    globalThis.__nightshiftPg.ready = (async () => {
      const { db, migrate } = await create();
      await migrate();
      globalThis.__nightshiftPg!.db = db;
    })().catch((e) => {
      globalThis.__nightshiftPg = undefined; // allow retry on transient failure
      throw e;
    });
  }
  await globalThis.__nightshiftPg.ready;
  return globalThis.__nightshiftPg.db;
}

export * as tables from "./schema";
