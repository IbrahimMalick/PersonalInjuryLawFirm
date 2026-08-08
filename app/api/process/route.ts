import { NextResponse } from "next/server";
import { processLead } from "@/lib/extract";
import { CASE_TYPE_LABEL, LANGUAGE_LABEL, ROUTING_LABEL } from "@/lib/labels";
import { findLead, log, readStore, writeStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function shortName(name: string | null): string {
  if (!name) return "Name unknown";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[parts.length - 1]}, ${parts[0][0]}.`;
}

export async function POST(request: Request) {
  const { leadId, simTime } = (await request.json()) as { leadId: string; simTime: string };
  const store = readStore();
  const lead = findLead(store, leadId);
  if (!lead) return NextResponse.json({ error: "Unknown lead" }, { status: 404 });
  if (lead.status === "done") return NextResponse.json({ lead, activity: store.activity });

  const t = simTime || lead.receivedLabel || "—";

  if (lead.hidden) {
    lead.hidden = false;
    log(store, t, `Held message released for processing — ${lead.from}`, "info");
  }

  const result = await processLead(lead);

  // The break-it retry is a deliberate on-camera moment, so it goes in the
  // activity feed. Ordinary live-call hiccups and fallbacks log to the server
  // console only (see lib/extract.ts).
  if (result.retried && lead.breakIt) {
    log(store, t, `Response failed validation — ${result.retryReason} — retrying (1 of 1)`, "warn");
    log(store, t, `Retry succeeded — clean case file recovered`, "ok");
  }

  lead.status = "done";
  lead.caseFile = result.caseFile;
  lead.draftReply = result.draftReply;
  lead.processedVia = result.via;
  lead.processedAtSim = t;

  const cf = result.caseFile;
  log(
    store,
    t,
    `Case file built — ${shortName(cf.claimant.name)} — ${CASE_TYPE_LABEL[cf.caseType]} — priority ${cf.priorityScore}`,
    "info"
  );

  for (const flag of cf.conflictFlags) {
    log(store, t, `CONFLICT CHECK: MATCH — ${flag} — held for conflicts review`, "flag");
  }

  const lang = LANGUAGE_LABEL[cf.claimant.preferredLanguage ?? "en"] ?? "English";
  if (cf.routing === "decline") {
    log(store, t, `Routed: ${ROUTING_LABEL[cf.routing]} — referral-out reply drafted (${lang})`, "info");
  } else if (cf.conflictFlags.length > 0) {
    log(store, t, `Reply drafted (${lang}) — HELD pending conflicts review`, "warn");
  } else {
    log(store, t, `Reply drafted (${lang}) — queued for morning review`, "ok");
  }

  writeStore(store);
  return NextResponse.json({ lead, activity: store.activity });
}
