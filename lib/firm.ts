import { eq } from "drizzle-orm";
import { getDb, tables } from "./db";
import type { FirmRow } from "./db/schema";

// Singleton firm row (id = 1). Created with placeholder values on first
// access; the /setup flow fills in the real identity.

export async function getFirm(): Promise<FirmRow> {
  const db = await getDb();
  const rows = await db.select().from(tables.firm).where(eq(tables.firm.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db
    .insert(tables.firm)
    .values({ id: 1, name: "Your Firm" })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  return (await db.select().from(tables.firm).where(eq(tables.firm.id, 1)).limit(1))[0];
}

export async function updateFirm(patch: Partial<Omit<FirmRow, "id" | "createdAt">>): Promise<void> {
  const db = await getDb();
  await getFirm(); // ensure the row exists
  await db.update(tables.firm).set(patch).where(eq(tables.firm.id, 1));
}

export function firmDisplayName(firm: FirmRow): string {
  return firm.name;
}
