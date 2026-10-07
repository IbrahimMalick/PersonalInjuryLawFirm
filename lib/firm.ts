import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb, tables } from "./db";
import type { FirmRow } from "./db/schema";
import { DEFAULT_PRACTICE_LINE } from "./labels";
import type { PracticeArea } from "./schema";

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

export interface DeletedFirmCounts {
  users: number;
  leads: number;
  messages: number;
  leadNotes: number;
  auditEvents: number;
  adverseParties: number;
}

/**
 * Deletes a firm and everything it owns. No FK cascades exist anywhere in
 * this schema (every `pgTable` here is a plain table — see lib/db/schema.ts),
 * so this is the one place that has to remember every firm-owned table, in
 * an order that leaves nothing orphaned. Irreversible, and makes no judgment
 * about whether it SHOULD happen — billing cleanup and the "are you sure"
 * confirmation are the caller's job (see app/operator/page.tsx, the only
 * caller, gated to platform operators).
 */
export async function deleteFirmCascade(firmId: number): Promise<DeletedFirmCounts> {
  const db = await getDb();

  // One transaction, not a bare sequence: without it, a failure partway
  // through (a dropped connection, an OOM kill) leaves the firm half-deleted
  // — some tables cleared, others not, with no way to tell from the outside
  // which. Since this operation is irreversible and runs unattended (no
  // retry UI), a torn result is worse than the delete simply not happening.
  return db.transaction(async (tx) => {
    const userIds = (
      await tx.select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.firmId, firmId))
    ).map((r) => r.id);
    if (userIds.length > 0) {
      // Keyed by userId, not firmId — sessions/authTokens have no firm column.
      await tx.delete(tables.sessions).where(inArray(tables.sessions.userId, userIds));
      await tx.delete(tables.authTokens).where(inArray(tables.authTokens.userId, userIds));
    }

    const messages = (
      await tx.delete(tables.messages).where(eq(tables.messages.firmId, firmId)).returning({ id: tables.messages.id })
    ).length;
    const leadNotes = (
      await tx.delete(tables.leadNotes).where(eq(tables.leadNotes.firmId, firmId)).returning({ id: tables.leadNotes.id })
    ).length;
    const auditEvents = (
      await tx.delete(tables.auditEvents).where(eq(tables.auditEvents.firmId, firmId)).returning({ id: tables.auditEvents.id })
    ).length;
    const adverseParties = (
      await tx
        .delete(tables.adverseParties)
        .where(eq(tables.adverseParties.firmId, firmId))
        .returning({ id: tables.adverseParties.id })
    ).length;
    const leads = (
      await tx.delete(tables.leads).where(eq(tables.leads.firmId, firmId)).returning({ id: tables.leads.id })
    ).length;
    const users = (
      await tx.delete(tables.users).where(eq(tables.users.firmId, firmId)).returning({ id: tables.users.id })
    ).length;
    await tx.delete(tables.firms).where(eq(tables.firms.id, firmId));

    return { users, leads, messages, leadNotes, auditEvents, adverseParties };
  });
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
export async function createFirm(
  name: string,
  practiceLine: string,
  practiceArea: PracticeArea = "personal_injury"
): Promise<FirmRow> {
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
          practiceArea,
          practiceLine: practiceLine.trim() || DEFAULT_PRACTICE_LINE[practiceArea],
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
