import { getDb, tables } from "./db";

// Append-only audit trail, scoped per firm. There is deliberately no update
// or delete path. firmId is null only for platform-level events.

export async function audit(
  type: string,
  opts: {
    firmId?: number | null;
    leadId?: string | null;
    userId?: number | null;
    detail?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const db = await getDb();
  await db.insert(tables.auditEvents).values({
    type,
    firmId: opts.firmId ?? null,
    leadId: opts.leadId ?? null,
    userId: opts.userId ?? null,
    detail: opts.detail ?? {},
  });
}
