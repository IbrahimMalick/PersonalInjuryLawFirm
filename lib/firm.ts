import crypto from "crypto";
import { eq } from "drizzle-orm";
import { getDb, tables } from "./db";
import type { FirmRow } from "./db/schema";

export async function getFirmById(id: number): Promise<FirmRow | null> {
  const db = await getDb();
  const rows = await db.select().from(tables.firms).where(eq(tables.firms.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getFirmBySlug(slug: string): Promise<FirmRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tables.firms)
    .where(eq(tables.firms.slug, slug.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateFirm(
  firmId: number,
  patch: Partial<Omit<FirmRow, "id" | "createdAt">>
): Promise<void> {
  const db = await getDb();
  await db.update(tables.firms).set(patch).where(eq(tables.firms.id, firmId));
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "firm"
  );
}

/** Create a firm with a unique slug and a fresh email-inbound token. */
export async function createFirm(name: string, practiceLine: string): Promise<FirmRow> {
  const db = await getDb();
  const base = slugify(name);
  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      const rows = await db
        .insert(tables.firms)
        .values({
          slug,
          name,
          practiceLine: practiceLine || "Injury Law",
          emailInboundToken: crypto.randomBytes(24).toString("base64url"),
        })
        .returning();
      return rows[0];
    } catch (e) {
      if (!String(e).includes("UNIQUE")) throw e;
    }
  }
  throw new Error("Could not allocate a unique firm slug");
}
