"use client";

import { useMemo, useState } from "react";
import type { PaymentStatus, TrialStatus } from "@/lib/marketing";

export interface MarketingTableRow {
  id: number;
  name: string;
  slug: string;
  contactEmail: string | null;
  createdAt: string; // ISO
  trial: TrialStatus;
  payment: PaymentStatus;
}

type SortKey = "createdAt" | "name" | "trial" | "payment";

const COLS: { key: SortKey; label: string }[] = [
  { key: "createdAt", label: "Registered" },
  { key: "name", label: "Firm" },
  { key: "trial", label: "Trial" },
  { key: "payment", label: "Payment" },
];

export default function MarketingTable({ rows }: { rows: MarketingTableRow[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.slug.toLowerCase().includes(q) ||
            (r.contactEmail ?? "").toLowerCase().includes(q)
        )
      : rows;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, query, sortKey, sortDir]);

  function toggleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search firm or email…"
          className="rounded-sm border border-ink-line bg-ink px-2 py-1 text-sm font-mono text-inktext w-64 focus:outline focus:outline-2 focus:outline-meter"
          aria-label="Search firms"
        />
        <span className="font-mono text-xs text-dim">
          {visible.length} of {rows.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-ink-line text-left">
              {COLS.map((c) => (
                <th key={c.key} className="pb-2 pr-4">
                  <button
                    onClick={() => toggleSort(c.key)}
                    className="field-label text-dim hover:text-inktext"
                  >
                    {c.label}
                    {sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
              <th className="pb-2 pr-4">
                <span className="field-label text-dim">Contact</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-ink-line/50">
                <td className="py-2 pr-4 font-mono text-dim">{r.createdAt.slice(0, 10)}</td>
                <td className="py-2 pr-4">
                  <span className="text-inktext">{r.name}</span>{" "}
                  <span className="font-mono text-xs text-dim">/{r.slug}</span>
                </td>
                <td className="py-2 pr-4">
                  <span className={r.trial === "active" ? "text-ok" : "text-dim"}>{r.trial}</span>
                </td>
                <td className="py-2 pr-4">
                  <span className={r.payment === "paid" ? "text-ok font-semibold" : "text-dim"}>
                    {r.payment}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-dim">{r.contactEmail ?? "—"}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-dim">
                  No firms match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
