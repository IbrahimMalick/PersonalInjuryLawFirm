"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DeskDataProvider, useDesk } from "./DeskData";
import { SimClockProvider, formatElapsed, useSimClock } from "./SimClock";
import ControlBar from "./ControlBar";

function FirmMark() {
  return (
    <Link href="/demo" className="flex items-center gap-3 shrink-0">
      <span
        aria-hidden
        className="grid place-items-center w-10 h-10 rounded-sm border-2 border-manila text-manila font-display font-bold text-lg leading-none tracking-tight"
      >
        R·C
      </span>
      <span className="leading-tight">
        <span className="block font-display font-bold text-xl tracking-wide text-paper uppercase">
          Reyes &amp; Cole
        </span>
        <span className="block field-label text-dim">Injury Law · Brooklyn NY · Nightshift intake</span>
      </span>
    </Link>
  );
}

function NavTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/demo", label: "Live Desk" },
    { href: "/demo/gap", label: "Cost of the Gap" },
    { href: "/demo/guardrails", label: "Guardrails" },
  ];
  return (
    <nav className="flex items-end gap-1 h-full" aria-label="Screens">
      {tabs.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`folder-tab px-5 pt-2 pb-1.5 font-display font-semibold text-base uppercase tracking-wider ${
              active
                ? "bg-manila text-papertext"
                : "bg-ink-raised text-dim hover:text-inktext"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// The emotional spine: the sim clock plus the running meter on the oldest
// unanswered inquiry. Amber is reserved for these two numbers.
function MeterBlock() {
  const clock = useSimClock();
  const desk = useDesk();

  const unanswered = desk.leads
    .filter((l) => desk.visible(l) && l.status === "new")
    .sort((a, b) => a.receivedOffsetMin - b.receivedOffsetMin);
  const oldest = unanswered[0];

  return (
    <div className="flex items-stretch gap-6 shrink-0 font-mono">
      <div className="text-right">
        <div className="field-label text-dim">Simulated time</div>
        <div className="text-meter text-3xl font-semibold tabular-nums leading-none mt-1">
          {clock.labelWithSeconds}
        </div>
      </div>
      <div className="w-px bg-ink-line" aria-hidden />
      {oldest ? (
        <div className="text-right">
          <div className="field-label text-dim">
            Oldest unanswered · {oldest.receivedLabel}
          </div>
          <div className="text-meter text-3xl font-semibold tabular-nums leading-none mt-1">
            {formatElapsed(clock.elapsedSince(oldest.receivedOffsetMin))}
          </div>
        </div>
      ) : (
        <div className="text-right">
          <div className="field-label text-dim">Inbox</div>
          <div className="text-ok text-2xl font-semibold leading-none mt-2">ALL ANSWERED</div>
        </div>
      )}
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SimClockProvider>
      <DeskDataProvider>
        <div className="min-h-screen flex flex-col">
          <header className="flex items-end justify-between gap-6 px-6 pt-4 border-b-2 border-ink-line bg-ink sticky top-0 z-30">
            <div className="flex items-end gap-10 pb-3">
              <FirmMark />
            </div>
            <div className="pb-3">
              <MeterBlock />
            </div>
            <div className="self-end">
              <NavTabs />
            </div>
          </header>
          <main className="flex-1 pb-24">{children}</main>
          <ControlBar />
        </div>
      </DeskDataProvider>
    </SimClockProvider>
  );
}
