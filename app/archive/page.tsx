import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import AppShell from "@/components/product/AppShell";
import { requireFirmUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { isDemo } from "@/lib/mode";
import { caseTypeLabelOf, contactOf, type AnyCaseFile } from "@/lib/casefile";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser();
  const db = await getDb();
  const leads = await db
    .select()
    .from(tables.leads)
    .where(and(eq(tables.leads.firmId, firm.id), eq(tables.leads.status, "archived")))
    .orderBy(desc(tables.leads.receivedAt))
    .limit(200);

  return (
    <AppShell user={user} firm={firm}>
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
              const cf = (lead.caseFile as unknown as AnyCaseFile | null) ?? null;
              return (
                <Link
                  key={lead.id}
                  href={`/lead/${lead.id}`}
                  className="flex items-center justify-between gap-4 rounded-sm border border-ink-line/50 px-4 py-2.5 bg-ink-raised opacity-80 hover:opacity-100 hover:border-manila"
                >
                  <span className="truncate">
                    <span className="text-inktext">
                      {(cf ? contactOf(cf).name : null) ?? lead.displayName ?? lead.fromAddress}
                    </span>
                    {cf && (
                      <span className="font-mono text-sm text-dim ml-3">
                        {caseTypeLabelOf(cf)}
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
