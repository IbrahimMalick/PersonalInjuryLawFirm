import { demoApiAllowed } from "@/lib/demo-guard";
import { NextResponse } from "next/server";
import type { ActivityEntry } from "@/lib/schema";
import { log, readStore, writeStore } from "@/lib/store";

// Client-originated activity entries: message arrivals, send confirmations.
export async function POST(request: Request) {
  if (!(await demoApiAllowed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { simTime, line, kind } = (await request.json()) as {
    simTime: string;
    line: string;
    kind?: ActivityEntry["kind"];
  };
  const store = readStore();
  log(store, simTime || "—", line, kind ?? "info");
  writeStore(store);
  return NextResponse.json({ activity: store.activity });
}
