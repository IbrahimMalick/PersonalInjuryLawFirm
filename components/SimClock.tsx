"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { SIM_START } from "@/lib/seeds";

// The simulated clock. Starts at 2:47 AM "tonight" and runs at 1×, 3×, or 60×
// real time. 60× exists for the cold open: 2:47 → 3:12 (the voicemail landing)
// takes 25 real seconds instead of 25 minutes.

export const SPEEDS = [1, 3, 60] as const;
export type Speed = (typeof SPEEDS)[number];

interface ClockAnchor {
  anchorReal: number; // Date.now() when anchor was set
  anchorSim: number; // sim time (ms epoch) at that moment
  speed: Speed;
}

interface SimClockValue {
  simMs: number;
  simStartMs: number;
  label: string; // "3:12 AM"
  labelWithSeconds: string; // "3:12:44 AM"
  speed: Speed;
  setSpeed: (s: Speed) => void;
  resetClock: () => void;
  /** Sim ms at which a lead with the given offset (minutes from sim start) arrived. */
  arrivalMs: (offsetMin: number) => number;
  /** Milliseconds of sim time elapsed since the given offset arrival (can be negative). */
  elapsedSince: (offsetMin: number) => number;
}

const Ctx = createContext<SimClockValue | null>(null);

function simStartToday(): number {
  const d = new Date();
  d.setHours(SIM_START.hour, SIM_START.minute, 0, 0);
  return d.getTime();
}

function freshAnchor(): ClockAnchor {
  return { anchorReal: Date.now(), anchorSim: simStartToday(), speed: 1 };
}

function loadAnchor(): ClockAnchor {
  try {
    const raw = sessionStorage.getItem("ns-clock");
    if (raw) return JSON.parse(raw) as ClockAnchor;
  } catch {}
  return freshAnchor();
}

export function formatSim(ms: number, withSeconds = false): string {
  const d = new Date(ms);
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  return withSeconds ? `${h}:${mm}:${ss} ${ampm}` : `${h}:${mm} ${ampm}`;
}

export function SimClockProvider({ children }: { children: React.ReactNode }) {
  const [anchor, setAnchor] = useState<ClockAnchor>(freshAnchor);
  const [nowReal, setNowReal] = useState<number>(() => Date.now());
  const startRef = useRef<number>(0);
  if (startRef.current === 0 && typeof window !== "undefined") {
    startRef.current = simStartToday();
  }

  useEffect(() => {
    setAnchor(loadAnchor());
    const id = setInterval(() => setNowReal(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const persist = (a: ClockAnchor) => {
    setAnchor(a);
    try {
      sessionStorage.setItem("ns-clock", JSON.stringify(a));
    } catch {}
  };

  const simMs = anchor.anchorSim + (nowReal - anchor.anchorReal) * anchor.speed;
  const simStartMs = startRef.current || simStartToday();

  const setSpeed = useCallback(
    (s: Speed) => {
      const current = anchor.anchorSim + (Date.now() - anchor.anchorReal) * anchor.speed;
      persist({ anchorReal: Date.now(), anchorSim: current, speed: s });
    },
    [anchor]
  );

  const resetClock = useCallback(() => {
    persist(freshAnchor());
  }, []);

  const arrivalMs = useCallback((offsetMin: number) => simStartMs + offsetMin * 60_000, [simStartMs]);
  const elapsedSince = useCallback(
    (offsetMin: number) => simMs - (simStartMs + offsetMin * 60_000),
    [simMs, simStartMs]
  );

  return (
    <Ctx.Provider
      value={{
        simMs,
        simStartMs,
        label: formatSim(simMs),
        labelWithSeconds: formatSim(simMs, true),
        speed: anchor.speed,
        setSpeed,
        resetClock,
        arrivalMs,
        elapsedSince,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSimClock(): SimClockValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSimClock outside provider");
  return v;
}

export function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
