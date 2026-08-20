import { NextResponse } from "next/server";
import { handleInboundSms, verifyTwilioSignature } from "@/lib/channels/twilio";

export const dynamic = "force-dynamic";

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
  await handleInboundSms(params);
  // Empty TwiML: the auto-reply comes later, after AI triage + human approval.
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response/>`, {
    headers: { "Content-Type": "text/xml" },
  });
}
