"use client";

import { useEffect, useState } from "react";
import { SPEEDS, useSimClock, type Speed } from "./SimClock";
import { useDesk } from "./DeskData";

// Floating demo controls. Keyboard: R reset · A run all · N run next ·
// C conflict lead · B break it · 1 / 3 / 6 speed.

export default function ControlBar() {
  const clock = useSimClock();
  const desk = useDesk();
  const [confirmReset, setConfirmReset] = useState(false);

  const nextPending = desk.leads.find(
    (l) => desk.visible(l) && l.status === "new" && !l.breakIt
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      switch (e.key.toLowerCase()) {
        case "r":
          desk.reset();
          break;
        case "a":
          desk.runAll();
          break;
        case "n":
          if (nextPending) desk.runOne(nextPending.id);
          break;
        case "c":
          desk.runConflict();
          break;
        case "b":
          desk.breakIt();
          break;
        case "1":
          clock.setSpeed(1);
          break;
        case "3":
          clock.setSpeed(3);
          break;
        case "6":
          clock.setSpeed(60);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desk, clock, nextPending]);

  const btn =
    "px-3 py-1.5 rounded-sm font-display font-semibold uppercase tracking-wider text-base border border-ink-line bg-ink-raised text-inktext hover:border-manila hover:text-manila focus-visible:outline focus-visible:outline-2 focus-visible:outline-meter disabled:opacity-40 disabled:hover:border-ink-line disabled:hover:text-inktext";

  return (
    <div
      role="toolbar"
      aria-label="Demo controls"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 rounded-md border-2 border-ink-line bg-ink/95 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
    >
      {confirmReset ? (
        <>
          <span className="text-sm text-dim px-1">Wipe everything and restart the night?</span>
          <button
            className={`${btn} !border-stamp !text-stamp`}
            onClick={() => {
              desk.reset();
              setConfirmReset(false);
            }}
          >
            Yes, reset
          </button>
          <button className={btn} onClick={() => setConfirmReset(false)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button className={`${btn} !border-stamp/70 !text-stamp`} onClick={() => setConfirmReset(true)} title="R">
            Reset
          </button>
          <span className="w-px h-6 bg-ink-line" aria-hidden />
          <button className={btn} onClick={desk.runAll} disabled={desk.running} title="A">
            Run all
          </button>
          <button
            className={btn}
            onClick={() => nextPending && desk.runOne(nextPending.id)}
            disabled={desk.running || !nextPending}
            title="N"
          >
            Run one
          </button>
          <button className={btn} onClick={desk.runConflict} disabled={desk.running} title="C">
            Conflict lead
          </button>
          <button className={btn} onClick={desk.breakIt} disabled={desk.running} title="B">
            Break it
          </button>
          <span className="w-px h-6 bg-ink-line" aria-hidden />
          <div className="flex items-center gap-1" role="group" aria-label="Clock speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => clock.setSpeed(s as Speed)}
                className={`px-2.5 py-1.5 rounded-sm font-mono text-sm border focus-visible:outline focus-visible:outline-2 focus-visible:outline-meter ${
                  clock.speed === s
                    ? "border-meter text-meter"
                    : "border-ink-line text-dim hover:text-inktext"
                }`}
                title={s === 1 ? "Real time (1)" : s === 3 ? "3× (3)" : "Cold open 60× (6)"}
              >
                {s === 1 ? "1×" : s === 3 ? "3×" : "60×"}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
