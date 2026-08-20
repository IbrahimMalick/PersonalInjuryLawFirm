import { demoApiAllowed } from "@/lib/demo-guard";
import { NextResponse } from "next/server";
import { makeBreakLead } from "@/lib/seeds";
import { log, readStore, writeStore } from "@/lib/store";

export async function POST(request: Request) {
  if (!(await demoApiAllowed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { simTime } = (await request.json()) as { simTime: string };
  const store = readStore();
  const lead = makeBreakLead();
  lead.receivedLabel = simTime || "—";
  store.leads.push(lead);
  log(store, simTime || "—", `Text message received — ${lead.from}`, "info");
  writeStore(store);
  return NextResponse.json({ lead, activity: store.activity });
}
