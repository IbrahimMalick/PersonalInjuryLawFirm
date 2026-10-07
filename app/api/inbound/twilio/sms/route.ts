import { NextResponse } from "next/server";
import {
  firmForTwilioNumber,
  handleInboundSms,
  verifyTwilioSignature,
} from "@/lib/channels/twilio";

export const dynamic = "force-dynamic";
// Vercel's default function timeout is too short for the after()-triggered
// triage kick (lib/queue.ts) to finish a real Claude call. See the audit
// note on app/api/inbound/webform/route.ts, which already had this.
export const maxDuration = 30;

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

async function formParams(request: Request): Promise<Record<string, string>> {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") params[k] = v;
  });
  return params;
}

export async function POST(request: Request) {
  const params = await formParams(request);
  if (!(await verifyTwilioSignature(request, params))) {
    return new NextResponse("invalid signature", { status: 403 });
  }
  const firm = await firmForTwilioNumber(params.To);
  if (!firm) {
    console.warn(`[twilio] SMS to unrouted number ${params.To} — dropped`);
    return new NextResponse(EMPTY_TWIML, { headers: { "Content-Type": "text/xml" } });
  }
  await handleInboundSms(firm, params);
  // Empty TwiML: the auto-reply comes later, after AI triage + human approval.
  return new NextResponse(EMPTY_TWIML, { headers: { "Content-Type": "text/xml" } });
}
