"use client";

import ActivityLog from "@/components/ActivityLog";
import CaseFilePanel from "@/components/CaseFilePanel";
import LeadCard from "@/components/LeadCard";
import { useDesk } from "@/components/DeskData";

export default function LiveDesk() {
  const desk = useDesk();

  const feed = desk.leads
    .filter((l) => desk.visible(l))
    .sort((a, b) => b.receivedOffsetMin - a.receivedOffsetMin); // newest first

  const selected =
    desk.leads.find((l) => l.id === desk.selectedId) ??
    feed.find((l) => l.status === "done") ??
    null;

  return (
    <div className="px-6 pt-4 grid grid-rows-[minmax(0,1fr)_150px] gap-3 h-[calc(100vh-170px)]">
      <div className="grid grid-cols-[430px_minmax(0,1fr)] gap-3 min-h-0">
        {/* Inbound feed */}
        <section aria-label="Inbound messages" className="min-h-0 flex flex-col">
          <div className="field-label text-dim pb-1.5 flex items-center justify-between">
            <span>Inbound — as it arrived</span>
            <span className="font-mono">
              {feed.filter((l) => l.status === "new").length} waiting
            </span>
          </div>
          <div className="overflow-y-auto space-y-2.5 pr-1 min-h-0">
            {feed.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
            {feed.length === 0 && (
              <div className="text-dim text-[15px] border border-ink-line rounded-sm p-4">
                Quiet for now. The clock is running.
              </div>
            )}
          </div>
        </section>

        {/* Extracted case file */}
        <section aria-label="Extracted case file" className="min-h-0 flex flex-col">
          <div className="field-label text-dim pb-1.5">What Nightshift made of it</div>
          <div className="min-h-0 flex-1">
            <CaseFilePanel lead={selected} />
          </div>
        </section>
      </div>

      <ActivityLog />
    </div>
  );
}
