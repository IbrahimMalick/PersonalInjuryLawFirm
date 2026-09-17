"use client";

import { useId, useState } from "react";
import type { TrendPoint } from "@/lib/marketing";

// Two-series grouped bar chart: registrations vs paid conversions per bucket.
// One shared count axis (never dual-axis for two measures of the same unit).
// Identity carried by a legend + direct color, reinforced by a 2px gap
// between the paired bars so the series stay visually separable.

const W = 640;
const H = 200;
const PAD_TOP = 10;
const PAD_BOTTOM = 26;
const GROUP_GAP = 6;
const BAR_GAP = 2;
const RADIUS = 3;

function topRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rad = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rad} Q${x},${y} ${x + rad},${y} H${x + w - rad} Q${x + w},${y} ${x + w},${y + rad} V${y + h} Z`;
}

const SERIES = [
  { key: "registrations" as const, label: "Registrations", color: "var(--manila)" },
  { key: "conversions" as const, label: "Paid conversions", color: "var(--ok)" },
];

export default function TrendBarChart({ points }: { points: TrendPoint[] }) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(1, ...points.map((p) => p.registrations), ...points.map((p) => p.conversions));
  const n = points.length;
  const groupW = (W - GROUP_GAP * (n - 1)) / n;
  const barW = (groupW - BAR_GAP) / 2;
  const labelStep = Math.max(1, Math.ceil(n / 8));

  return (
    <div className="relative">
      <div className="flex items-center gap-4 pb-2">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 font-mono text-xs text-dim">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[200px]" role="img" aria-label="Registrations vs paid conversions over time">
        <defs>
          {SERIES.map((s) => (
            <linearGradient key={s.key} id={`${gradId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.55" />
            </linearGradient>
          ))}
        </defs>
        {[0.33, 0.66].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={PAD_TOP + chartH * f}
            y2={PAD_TOP + chartH * f}
            stroke="var(--ink-line)"
            strokeWidth={1}
            opacity={0.5}
          />
        ))}
        <line x1={0} x2={W} y1={PAD_TOP + chartH} y2={PAD_TOP + chartH} stroke="var(--ink-line)" strokeWidth={1} />
        {points.map((p, i) => {
          const gx = i * (groupW + GROUP_GAP);
          const isHover = hover === i;
          return (
            <g key={i}>
              <rect
                x={gx}
                y={PAD_TOP}
                width={groupW}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              />
              {SERIES.map((s, si) => {
                const value = p[s.key];
                const x = gx + si * (barW + BAR_GAP);
                const h = value > 0 ? Math.max(2, (value / max) * chartH) : 0;
                const y = PAD_TOP + chartH - h;
                return value > 0 ? (
                  <path
                    key={s.key}
                    d={topRoundedRectPath(x, y, barW, h, RADIUS)}
                    fill={isHover ? s.color : `url(#${gradId}-${s.key})`}
                    className="transition-[fill] duration-100"
                    pointerEvents="none"
                  />
                ) : (
                  <circle
                    key={s.key}
                    cx={x + barW / 2}
                    cy={PAD_TOP + chartH}
                    r={1.5}
                    fill="var(--ink-line)"
                    pointerEvents="none"
                  />
                );
              })}
              {isHover && (
                <rect x={gx} y={PAD_TOP} width={groupW} height={chartH} fill="var(--paper)" opacity={0.05} pointerEvents="none" />
              )}
              {i % labelStep === 0 && (
                <text
                  x={gx + groupW / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill="var(--text-dim)"
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-sm border border-ink-line bg-ink-raised px-2 py-1 font-mono text-xs text-inktext shadow-lg whitespace-nowrap"
          style={{ left: `${((hover + 0.5) / n) * 100}%`, top: 0 }}
        >
          <span className="text-dim">{points[hover].label}</span>{" "}
          {points[hover].registrations} reg · {points[hover].conversions} paid
        </div>
      )}
    </div>
  );
}
