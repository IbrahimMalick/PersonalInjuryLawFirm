import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import AppShell from "@/components/product/AppShell";
import { audit } from "@/lib/audit";
import { requireFirmUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { isDemo } from "@/lib/mode";

export const dynamic = "force-dynamic";

// The firm's conflict list. Every extracted name on every new lead is checked
// against the active entries here. Entries are deactivated, never deleted —
// the audit story matters more than a tidy table.

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
  searchParams: Promise<{ error?: string }>;
}) {
  if (isDemo()) redirect("/demo");
  const { user, firm } = await requireFirmUser("admin");
  const db = await getDb();
  const parties = await db
    .select()
    .from(tables.adverseParties)
    .where(eq(tables.adverseParties.firmId, firm.id))
    .orderBy(desc(tables.adverseParties.active), desc(tables.adverseParties.id));
  const { error } = await searchParams;

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
