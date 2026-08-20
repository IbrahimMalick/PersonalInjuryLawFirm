import { getDb, tables } from "./db";

// Append-only audit trail. Everything consequential — machine or human —
// goes through here. There is deliberately no update or delete path.

export async function audit(
  type: string,
  opts: {
    leadId?: string | null;
    userId?: number | null;
    detail?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const db = await getDb();
  await db.insert(tables.auditEvents).values({
    type,
    leadId: opts.leadId ?? null,
    userId: opts.userId ?? null,
    detail: opts.detail ?? {},
  });
}
