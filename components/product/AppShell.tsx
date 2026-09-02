import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { destroySession, isOperator } from "@/lib/auth";
import type { FirmRow, UserRow } from "@/lib/db/schema";
import { getDb, tables } from "@/lib/db";
import RealMeter from "./RealMeter";
import NavTabs from "./NavTabs";

async function logout(): Promise<void> {
  "use server";
  await destroySession();
  redirect("/login");
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("·");
}

/** Oldest inquiry AT THIS FIRM with no outbound reply yet — the meter. */
async function oldestUnanswered(firmId: number): Promise<string | null> {
  const db = await getDb();
  const replied = db
    .select({ leadId: tables.messages.leadId })
    .from(tables.messages)
    .where(
      and(
        eq(tables.messages.firmId, firmId),
        inArray(tables.messages.status, ["queued", "sent", "simulated"])
      )
    );
  const rows = await db
    .select({ receivedAt: tables.leads.receivedAt })
    .from(tables.leads)
    .where(
      and(
        eq(tables.leads.firmId, firmId),
        notInArray(tables.leads.status, ["archived"]),
        notInArray(tables.leads.id, replied)
      )
    )
    .orderBy(tables.leads.receivedAt)
    .limit(1);
  return rows[0]?.receivedAt ?? null;
}

export default async function AppShell({
  children,
  user,
  firm,
}: {
  children: React.ReactNode;
  user: UserRow;
  firm: FirmRow;
}) {
  const oldest = await oldestUnanswered(firm.id);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-end justify-between gap-6 px-6 pt-4 border-b-2 border-ink-line bg-ink sticky top-0 z-30">
        <div className="flex items-end gap-10 pb-3">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <span
              aria-hidden
              className="grid place-items-center w-10 h-10 rounded-sm border-2 border-manila text-manila font-display font-bold text-lg leading-none tracking-tight"
            >
              {initials(firm.name)}
            </span>
            <span className="leading-tight">
              <span className="block font-display font-bold text-xl tracking-wide text-paper uppercase">
                {firm.name}
              </span>
              <span className="block field-label text-dim">
                {firm.practiceLine} · Nightshift intake
              </span>
            </span>
          </Link>
        </div>
        <div className="pb-3">
          <RealMeter oldestReceivedAt={oldest} timezone={firm.timezone} />
        </div>
        <div className="self-end flex items-end gap-4">
          <NavTabs isAdmin={user.role === "admin"} isOperator={isOperator(user)} />
        </div>
      </header>
      <div className="flex items-center justify-end gap-3 px-6 py-1.5 border-b border-ink-line bg-ink-raised/50">
        <span className="font-mono text-xs text-dim">
          {user.name} · {user.role}
        </span>
        <form action={logout}>
          <button className="field-label text-dim hover:text-stamp" type="submit">
            Sign out
          </button>
        </form>
      </div>
      <main className="flex-1 pb-10">{children}</main>
    </div>
  );
}
