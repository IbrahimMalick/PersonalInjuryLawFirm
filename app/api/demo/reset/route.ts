import { demoApiAllowed } from "@/lib/demo-guard";
import { NextResponse } from "next/server";
import { resetStore } from "@/lib/store";

export async function POST() {
  if (!(await demoApiAllowed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(resetStore());
}
