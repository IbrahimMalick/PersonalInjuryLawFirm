"use client";

import { useEffect, useRef } from "react";
import { useDesk } from "./DeskData";

const KIND_COLOR: Record<string, string> = {
  info: "text-dim",
  ok: "text-ok",
  warn: "text-meter",
  flag: "text-stamp",
};

export default function ActivityLog() {
  const { activity } = useDesk();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [activity.length]);

  return (
    <section
      aria-label="Activity log"
      className="rounded-sm border border-ink-line bg-ink-raised h-full flex flex-col"
    >
      <div className="field-label text-dim px-3 pt-2 pb-1 border-b border-ink-line shrink-0">
        Tonight&apos;s activity
      </div>
      <div className="overflow-y-auto px-3 py-2 font-mono text-sm leading-6">
        {activity.map((a, idx) => (
          <div key={idx} className="flex gap-3">
            <span className="text-meter/80 tabular-nums shrink-0 w-20">{a.t}</span>
            <span className={KIND_COLOR[a.kind] ?? "text-dim"}>{a.line}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
