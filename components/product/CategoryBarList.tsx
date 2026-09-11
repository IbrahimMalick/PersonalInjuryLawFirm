import type { CategoryCount } from "@/lib/insights";

// Magnitude-by-category, sorted descending: one hue, direct labels (count +
// share), no legend needed — a single series never needs one. Plain HTML bars
// read better here than SVG and need no client JS.

export default function CategoryBarList({
  items,
  color = "var(--manila)",
  emptyText = "No data yet for this period.",
}: {
  items: CategoryCount[];
  color?: string;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="text-dim text-sm py-6 text-center">{emptyText}</p>;
  }
  const max = Math.max(...items.map((i) => i.count));
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-[14px] text-inktext" title={item.label}>
            {item.label}
          </span>
          <span className="flex-1 h-4 rounded-sm bg-ink-line/25 overflow-hidden">
            <span
              className="block h-full rounded-r-sm"
              style={{ width: `${Math.max(3, (item.count / max) * 100)}%`, backgroundColor: color }}
            />
          </span>
          <span className="w-20 shrink-0 text-right font-mono text-sm text-dim tabular-nums">
            {item.count} · {item.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}
