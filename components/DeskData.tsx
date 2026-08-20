"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ActivityEntry, Lead, Store } from "@/lib/schema";
import { formatSim, useSimClock } from "./SimClock";

interface DeskValue {
  leads: Lead[]; // all leads, including hidden/not-yet-arrived — components filter
  activity: ActivityEntry[];
  processing: Set<string>;
  revealAt: Record<string, number>; // real ms when a lead's case file arrived (drives the reveal)
  selectedId: string | null;
  select: (id: string | null) => void;
  visible: (lead: Lead) => boolean; // arrived and not hidden
  runOne: (id: string) => Promise<void>;
  runAll: () => Promise<void>;
  runConflict: () => Promise<void>;
  breakIt: () => Promise<void>;
  reset: () => Promise<void>;
  logLine: (line: string, kind?: ActivityEntry["kind"]) => Promise<void>;
  running: boolean;
}

const Ctx = createContext<DeskValue | null>(null);

export function DeskDataProvider({ children }: { children: React.ReactNode }) {
  const clock = useSimClock();
  const [store, setStore] = useState<Store | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [revealAt, setRevealAt] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const arrivalLogged = useRef<Set<string>>(new Set());
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const refresh = useCallback(async () => {
    const res = await fetch("/api/demo/state", { cache: "no-store" });
    setStore((await res.json()) as Store);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const visible = useCallback(
    (lead: Lead) =>
      !lead.hidden &&
      (lead.status !== "new" || clock.simMs >= clock.arrivalMs(lead.receivedOffsetMin)),
    [clock]
  );

  // Log arrivals of leads that land after the sim start (the 3:12 AM voicemail).
  useEffect(() => {
    if (!store) return;
    for (const lead of store.leads) {
      if (lead.hidden || lead.receivedOffsetMin <= 0) continue;
      const arrived = clock.simMs >= clock.arrivalMs(lead.receivedOffsetMin);
      if (arrived && !arrivalLogged.current.has(lead.id)) {
        arrivalLogged.current.add(lead.id);
        const line =
          lead.channel === "voicemail"
            ? `Voicemail received — ${lead.from} (${Math.floor((lead.meta?.durationSec ?? 0) / 60)}:${String((lead.meta?.durationSec ?? 0) % 60).padStart(2, "0")})`
            : `Message received — ${lead.from}`;
        fetch("/api/demo/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ simTime: lead.receivedLabel, line, kind: "info" }),
        }).then(refresh);
      }
    }
  }, [clock.simMs, store, clock, refresh]);

  const applyResponse = useCallback((data: { lead?: Lead; activity: ActivityEntry[] }) => {
    setStore((prev) => {
      if (!prev) return prev;
      const leads = data.lead
        ? prev.leads.some((l) => l.id === data.lead!.id)
          ? prev.leads.map((l) => (l.id === data.lead!.id ? data.lead! : l))
          : [...prev.leads, data.lead!]
        : prev.leads;
      return { ...prev, leads, activity: data.activity };
    });
  }, []);

  const processOne = useCallback(
    async (id: string) => {
      setProcessing((p) => new Set(p).add(id));
      setSelectedId(id);
      try {
        const res = await fetch("/api/demo/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: id, simTime: formatSim(clockRef.current.simMs) }),
        });
        if (res.ok) {
          const data = await res.json();
          applyResponse(data);
          setRevealAt((r) => ({ ...r, [id]: Date.now() }));
        }
      } finally {
        setProcessing((p) => {
          const next = new Set(p);
          next.delete(id);
          return next;
        });
      }
    },
    [applyResponse]
  );

  const runOne = useCallback(
    async (id: string) => {
      if (running || processing.has(id)) return;
      setRunning(true);
      try {
        await processOne(id);
      } finally {
        setRunning(false);
      }
    },
    [running, processing, processOne]
  );

  const runAll = useCallback(async () => {
    if (!store || running) return;
    setRunning(true);
    try {
      // Sequential on purpose — each reveal gets its moment on camera.
      const pending = store.leads.filter(
        (l) => !l.hidden && !l.breakIt && l.status === "new"
      );
      for (const lead of pending) {
        // A "Run all" pulls in the not-yet-arrived voicemail too.
        await processOne(lead.id);
        await new Promise((r) => setTimeout(r, 2600)); // let the reveal finish
      }
    } finally {
      setRunning(false);
    }
  }, [store, running, processOne]);

  const runConflict = useCallback(async () => {
    if (!store || running) return;
    const conflictLead = store.leads.find((l) => l.id === "lead-sms-conflict");
    if (!conflictLead || conflictLead.status === "done") return;
    setRunning(true);
    try {
      await processOne(conflictLead.id);
    } finally {
      setRunning(false);
    }
  }, [store, running, processOne]);

  const breakIt = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/demo/break", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simTime: formatSim(clockRef.current.simMs) }),
      });
      const data = await res.json();
      applyResponse(data);
      await new Promise((r) => setTimeout(r, 900)); // the message lands, then processing starts
      await processOne(data.lead.id);
    } finally {
      setRunning(false);
    }
  }, [running, applyResponse, processOne]);

  const reset = useCallback(async () => {
    const res = await fetch("/api/demo/reset", { method: "POST" });
    setStore((await res.json()) as Store);
    setProcessing(new Set());
    setRevealAt({});
    setSelectedId(null);
    setRunning(false);
    arrivalLogged.current.clear();
    clockRef.current.resetClock();
  }, []);

  const logLine = useCallback(
    async (line: string, kind: ActivityEntry["kind"] = "info") => {
      const res = await fetch("/api/demo/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simTime: formatSim(clockRef.current.simMs), line, kind }),
      });
      const data = await res.json();
      setStore((prev) => (prev ? { ...prev, activity: data.activity } : prev));
    },
    []
  );

  return (
    <Ctx.Provider
      value={{
        leads: store?.leads ?? [],
        activity: store?.activity ?? [],
        processing,
        revealAt,
        selectedId,
        select: setSelectedId,
        visible,
        runOne,
        runAll,
        runConflict,
        breakIt,
        reset,
        logLine,
        running,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDesk(): DeskValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDesk outside provider");
  return v;
}
