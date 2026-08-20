import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

// One SQLite file per firm instance. DATABASE_PATH points at a mounted volume
// in production (see Dockerfile); defaults to ./data locally.

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "nightshift.db");

type DB = LibSQLDatabase<typeof schema>;

declare global {
  // Survive Next.js dev-server module reloads without re-opening handles.
  var __nightshiftDb:
    | { client: Client; db: DB; ready: Promise<void> | null }
    | undefined;
}

function init(): { client: Client; db: DB; ready: Promise<void> | null } {
  if (!globalThis.__nightshiftDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const client = createClient({ url: `file:${DB_PATH}` });
    const db = drizzle(client, { schema });
    globalThis.__nightshiftDb = { client, db, ready: null };
  }
  return globalThis.__nightshiftDb;
}

export async function getDb(): Promise<DB> {
  const holder = init();
  // Single shared promise so concurrent first callers (worker boot + first
  // HTTP request) never run migrations twice.
  if (!holder.ready) {
    holder.ready = (async () => {
      await holder.client.execute("PRAGMA journal_mode = WAL;");
      await holder.client.execute("PRAGMA busy_timeout = 5000;");
      await migrate(holder.db, {
        migrationsFolder: path.join(process.cwd(), "drizzle"),
      });
    })().catch((e) => {
      holder.ready = null; // allow retry on transient failure
      throw e;
    });
  }
  await holder.ready;
  return holder.db;
}

export * as tables from "./schema";
