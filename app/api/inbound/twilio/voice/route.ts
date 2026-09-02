import { NextResponse } from "next/server";
import {
  firmForTwilioNumber,
  verifyTwilioSignature,
  voicemailTwiml,
} from "@/lib/channels/twilio";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") params[k] = v;
  });
  if (!(await verifyTwilioSignature(request, params))) {
    return new NextResponse("invalid signature", { status: 403 });
  }
  const firm = await firmForTwilioNumber(params.To);
  const twiml = firm
    ? voicemailTwiml(firm.name)
    : `<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not yet in service.</Say></Response>`;
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}
