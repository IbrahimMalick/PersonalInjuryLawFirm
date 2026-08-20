import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import AppShell from "@/components/product/AppShell";
import { requireUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { getFirm } from "@/lib/firm";
import { fmtDateTime } from "@/lib/format";
import { isDemo } from "@/lib/mode";
import type { CaseFile } from "@/lib/schema";
import { CASE_TYPE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  if (isDemo()) redirect("/demo");
  const user = await requireUser();
  const firm = await getFirm();
  const db = await getDb();
  const leads = await db
    .select()
    .from(tables.leads)
    .where(eq(tables.leads.status, "archived"))
    .orderBy(desc(tables.leads.receivedAt))
    .limit(200);

  return (
    <AppShell user={user}>
      <div className="px-6 pt-4 max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between pb-3">
          <h1 className="font-display font-bold uppercase tracking-wide text-xl text-paper">
            Archive
          </h1>
          <Link href="/" className="field-label text-dim hover:text-inktext">
            ← Inbox
          </Link>
        </div>
        {leads.length === 0 ? (
          <p className="text-dim text-[15px]">Nothing archived yet.</p>
        ) : (
          <div className="space-y-2">
            {leads.map((lead) => {
              const cf = (lead.caseFile as unknown as CaseFile | null) ?? null;
              return (
                <Link
                  key={lead.id}
                  href={`/lead/${lead.id}`}
                  className="flex items-center justify-between gap-4 rounded-sm border border-ink-line/50 px-4 py-2.5 bg-ink-raised opacity-80 hover:opacity-100 hover:border-manila"
                >
                  <span className="truncate">
                    <span className="text-inktext">
                      {cf?.claimant.name ?? lead.displayName ?? lead.fromAddress}
                    </span>
                    {cf && (
                      <span className="font-mono text-sm text-dim ml-3">
                        {CASE_TYPE_LABEL[cf.caseType]}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-dim shrink-0">
                    {fmtDateTime(lead.receivedAt, firm.timezone)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
