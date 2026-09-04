import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import AppShell from "@/components/product/AppShell";
import { audit } from "@/lib/audit";
import { requireFirmUser } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { getDb, tables } from "@/lib/db";
import { isDemo } from "@/lib/mode";

export const dynamic = "force-dynamic";

// The firm's conflict list. Every extracted name on every new lead is checked
// against the active entries here. Entries are deactivated, never deleted —
// the audit story matters more than a tidy table.

// The placeholder row in /conflict-list-template.csv — skip it on import so a
// forgotten example doesn't become a real conflict entry.
const TEMPLATE_EXAMPLE = "jane roe (example — replace or delete this row)";
const MAX_IMPORT_BYTES = 1_000_000;

async function addParty(formData: FormData): Promise<void> {
  "use server";
  const { user, firm } = await requireFirmUser("admin");
  const name = String(formData.get("name") ?? "").trim();
  const relationship = String(formData.get("relationship") ?? "").trim();
  if (!name || !relationship) redirect("/settings/conflicts?error=1");
  const db = await getDb();
  await db
    .insert(tables.adverseParties)
    .values({ firmId: firm.id, name, relationship, createdBy: user.id });
  await audit("settings.conflict_party_added", { firmId: firm.id, userId: user.id, detail: { name } });
  revalidatePath("/settings/conflicts");
}

async function importParties(formData: FormData): Promise<void> {
  "use server";
  const { user, firm } = await requireFirmUser("admin");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/settings/conflicts?importError=empty");
  }
  if (file.size > MAX_IMPORT_BYTES) redirect("/settings/conflicts?importError=big");

  const rows = parseCsv(await file.text()).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) redirect("/settings/conflicts?importError=empty");

  // Drop a header row if the first cell looks like a header.
  const firstCell = (rows[0][0] ?? "").trim().toLowerCase();
  const body = firstCell === "name" ? rows.slice(1) : rows;

  const db = await getDb();
  const current = await db
    .select({ name: tables.adverseParties.name })
    .from(tables.adverseParties)
    .where(and(eq(tables.adverseParties.firmId, firm.id), eq(tables.adverseParties.active, true)));
  const have = new Set(current.map((c) => c.name.trim().toLowerCase()));

  const toInsert: {
    firmId: number;
    name: string;
    relationship: string;
    createdBy: number;
  }[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const r of body) {
    const name = (r[0] ?? "").trim();
    const relationship = (r[1] ?? "").trim();
    const key = name.toLowerCase();
    if (!name || !relationship || key === TEMPLATE_EXAMPLE || have.has(key) || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    toInsert.push({ firmId: firm.id, name, relationship, createdBy: user.id });
  }

  if (toInsert.length > 0) {
    await db.insert(tables.adverseParties).values(toInsert);
    await audit("settings.conflict_list_imported", {
      firmId: firm.id,
      userId: user.id,
      detail: { imported: toInsert.length, skipped },
    });
  }
  redirect(`/settings/conflicts?imported=${toInsert.length}&skipped=${skipped}`);
}

async function deactivateParty(formData: FormData): Promise<void> {
  "use server";
  const { user, firm } = await requireFirmUser("admin");
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db
    .update(tables.adverseParties)
    .set({ active: false })
    .where(and(eq(tables.adverseParties.id, id), eq(tables.adverseParties.firmId, firm.id)));
  await audit("settings.conflict_party_deactivated", { firmId: firm.id, userId: user.id, detail: { id } });
  revalidatePath("/settings/conflicts");
}

export default async function ConflictsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    imported?: string;
    skipped?: string;
    importError?: string;
  }>;
}) {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser("admin");
  const db = await getDb();
  const parties = await db
    .select()
    .from(tables.adverseParties)
    .where(eq(tables.adverseParties.firmId, firm.id))
    .orderBy(desc(tables.adverseParties.active), desc(tables.adverseParties.id));
  const { error, imported, skipped, importError } = await searchParams;

  const input =
    "w-full rounded-sm border border-ink-line bg-ink px-3 py-2 text-[15px] text-inktext focus:outline focus:outline-2 focus:outline-meter";

  return (
    <AppShell user={user} firm={firm}>
      <div className="px-6 pt-4 pb-10 max-w-[900px] mx-auto">
        <div className="flex items-center justify-between pb-3">
          <h1 className="font-display font-bold uppercase tracking-wide text-2xl text-paper">
            Conflict list
          </h1>
          <Link href="/settings" className="field-label text-dim hover:text-inktext">
            ← Settings
          </Link>
        </div>
        <p className="text-dim text-[15px] pb-4 max-w-2xl">
          Current clients, adverse parties, and anyone else a new inquiry must never be pursued
          against. Every name the engine extracts is checked here; a match holds the reply and
          flags the case in red. Entries are deactivated rather than deleted.
        </p>

        <form
          action={addParty}
          className="grid grid-cols-[1fr_2fr_auto] gap-2 pb-5 items-end"
        >
          <label className="block">
            <span className="field-label text-dim">Name</span>
            <input name="name" className={input} placeholder="Marcus Whitfield" />
          </label>
          <label className="block">
            <span className="field-label text-dim">Relationship / matter</span>
            <input
              name="relationship"
              className={input}
              placeholder="Current client — Whitfield v. Crown Deli Corp. (active)"
            />
          </label>
          <button className="rounded-sm bg-manila text-papertext font-display font-bold uppercase tracking-wider px-4 py-2 hover:bg-manila-deep">
            Add
          </button>
          {error && (
            <p className="col-span-3 text-stamp text-sm">Both fields are required.</p>
          )}
        </form>

        <div className="rounded-sm border border-ink-line bg-ink-raised px-4 py-3 mb-5">
          <div className="field-label text-dim pb-1">Bulk import</div>
          <p className="text-sm text-dim pb-2 leading-snug">
            Adding a lot at once?{" "}
            <a
              href="/conflict-list-template.csv"
              download
              className="text-manila underline underline-offset-4"
            >
              Download the CSV template
            </a>
            , fill it in (opens in Excel or Google Sheets), then upload it here. Two columns —{" "}
            <span className="font-mono">name</span> and{" "}
            <span className="font-mono">relationship</span>. Blank rows, duplicates, and names
            already on the list are skipped.
          </p>
          <form action={importParties} className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="text-sm text-inktext file:mr-3 file:rounded-sm file:border-0 file:bg-manila file:text-papertext file:px-3 file:py-1.5 file:font-display file:font-bold file:uppercase file:tracking-wide file:cursor-pointer"
            />
            <button className="rounded-sm border border-manila text-manila font-display font-bold uppercase tracking-wider px-4 py-2 hover:bg-manila/10 shrink-0">
              Import
            </button>
          </form>
          {imported !== undefined && (
            <p className="text-ok text-sm mt-2">
              Imported {imported} entr{imported === "1" ? "y" : "ies"}
              {skipped && skipped !== "0" ? ` · skipped ${skipped}` : ""}.
            </p>
          )}
          {importError && (
            <p className="text-stamp text-sm mt-2">
              {importError === "big"
                ? "That file is too large (limit 1 MB)."
                : "That file was empty or unreadable — start from the template."}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          {parties.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-4 rounded-sm border px-4 py-2.5 ${
                p.active ? "border-ink-line bg-ink-raised" : "border-ink-line/40 opacity-50"
              }`}
            >
              <span className="min-w-0 truncate">
                <span className="text-inktext font-semibold">{p.name}</span>
                <span className="text-dim ml-3 text-[14px]">{p.relationship}</span>
              </span>
              {p.active ? (
                <form action={deactivateParty}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="field-label text-dim hover:text-stamp shrink-0">
                    Deactivate
                  </button>
                </form>
              ) : (
                <span className="field-label text-dim shrink-0">inactive</span>
              )}
            </div>
          ))}
          {parties.length === 0 && (
            <p className="text-dim text-[15px] border border-ink-line rounded-sm px-4 py-6 text-center">
              Empty conflict list — the conflict check passes everything until names are added.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
