import { demoApiAllowed } from "@/lib/demo-guard";
import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await demoApiAllowed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(readStore());
}
