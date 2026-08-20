"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatElapsed } from "@/components/SimClock";

// The live-mode meter: real wall-clock time in the firm's timezone, and the
// running wait on the oldest unanswered inquiry. Same emotional device as the
// demo — no simulation. Also quietly refreshes server data so new leads
// appear without a manual reload.

export default function RealMeter({
  oldestReceivedAt,
  timezone,
}: {
  oldestReceivedAt: string | null;
  timezone: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => router.refresh(), 20_000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  let clock = "";
  try {
    clock = new Date(now).toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    clock = new Date(now).toLocaleTimeString("en-US");
  }

  const oldestMs = oldestReceivedAt
    ? Date.parse(oldestReceivedAt.endsWith("Z") ? oldestReceivedAt : oldestReceivedAt + "Z")
    : null;

  return (
    <div className="flex items-stretch gap-6 shrink-0 font-mono">
      <div className="text-right">
        <div className="field-label text-dim">Firm time</div>
        <div className="text-meter text-3xl font-semibold tabular-nums leading-none mt-1">
          {clock}
        </div>
      </div>
      <div className="w-px bg-ink-line" aria-hidden />
      {oldestMs ? (
        <div className="text-right">
          <div className="field-label text-dim">Oldest unanswered</div>
          <div className="text-meter text-3xl font-semibold tabular-nums leading-none mt-1">
            {formatElapsed(now - oldestMs)}
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
