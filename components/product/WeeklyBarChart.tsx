"use client";

import { useId, useState } from "react";
import { fmtHours, type WeekPoint } from "@/lib/insights";

// A single-series magnitude-over-time chart (leads/week, response-time/week).
// One hue, thin top-rounded bars anchored to the baseline, recessive gridlines,
// a hover tooltip, and direct labels only where they fit without colliding.
//
// valueKind picks the label formatter instead of taking a function prop — a
// function can't cross the server->client boundary from the page that renders
// this component.

const W = 600;
const H = 168;
const PAD_TOP = 10;
const PAD_BOTTOM = 26;
const BAR_GAP = 4;
const RADIUS = 3;

function topRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rad = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rad} Q${x},${y} ${x + rad},${y} H${x + w - rad} Q${x + w},${y} ${x + w},${y + rad} V${y + h} Z`;
}

export default function WeeklyBarChart({
  points,
  color,
  valueKind,
  unitLabel = "",
  emptyLabel = "no data",
}: {
  points: WeekPoint[];
  color: string;
  valueKind: "count" | "medianHours";
  /** Plural noun for "count" values, e.g. "leads". Ignored for "medianHours". */
  unitLabel?: string;
  emptyLabel?: string;
}) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const formatValue =
    valueKind === "medianHours"
      ? (v: number) => `median ${fmtHours(v)}`
      : (v: number) => `${v} ${v === 1 ? unitLabel.replace(/s$/, "") : unitLabel}`;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const values = points.map((p) => p.value ?? 0);
  const max = Math.max(1, ...values);
  const n = points.length;
  const barW = (W - BAR_GAP * (n - 1)) / n;
  const labelStep = Math.max(1, Math.ceil(n / 7));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[168px]" role="img" aria-label="Weekly chart">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {/* recessive gridlines */}
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
        <line
          x1={0}
          x2={W}
          y1={PAD_TOP + chartH}
          y2={PAD_TOP + chartH}
          stroke="var(--ink-line)"
          strokeWidth={1}
        />
        {points.map((p, i) => {
          const x = i * (barW + BAR_GAP);
          const hasValue = p.value !== null && p.value > 0;
          const h = hasValue ? Math.max(3, (p.value! / max) * chartH) : 0;
          const y = PAD_TOP + chartH - h;
          const isHover = hover === i;
          return (
            <g key={i}>
              {/* full-column hit target so even zero/short bars are easy to hover */}
              <rect
                x={x}
                y={PAD_TOP}
                width={barW}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h2) => (h2 === i ? null : h2))}
              />
              {hasValue ? (
                <path
                  d={topRoundedRectPath(x, y, barW, h, RADIUS)}
                  fill={isHover ? color : `url(#${gradId})`}
                  className="transition-[fill] duration-100"
                  pointerEvents="none"
                >
                  <title>{`${p.label}: ${formatValue(p.value!)}`}</title>
                </path>
              ) : (
                <circle
                  cx={x + barW / 2}
                  cy={PAD_TOP + chartH}
                  r={1.5}
                  fill="var(--ink-line)"
                  pointerEvents="none"
                >
                  <title>{`${p.label}: ${emptyLabel}`}</title>
                </circle>
              )}
              {isHover && (
                <rect
                  x={x}
                  y={PAD_TOP}
                  width={barW}
                  height={chartH}
                  fill="var(--paper)"
                  opacity={0.05}
                  pointerEvents="none"
                />
              )}
              {i % labelStep === 0 && (
                <text
                  x={x + barW / 2}
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
          className="pointer-events-none absolute -translate-x-1/2 rounded-sm border border-ink-line bg-ink-raised px-2 py-1 font-mono text-xs text-inktext shadow-lg"
          style={{
            left: `${((hover + 0.5) / n) * 100}%`,
            top: 0,
          }}
        >
          <span className="text-dim">{points[hover].label}</span>{" "}
          {points[hover].value !== null ? formatValue(points[hover].value!) : emptyLabel}
        </div>
      )}
    </div>
  );
}
