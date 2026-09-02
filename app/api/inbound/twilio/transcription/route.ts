import { NextResponse } from "next/server";
import {
  firmForTwilioNumber,
  handleTranscription,
  verifyTwilioSignature,
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
  if (firm) await handleTranscription(firm, params);
  else console.warn(`[twilio] transcription for unrouted number ${params.To} — dropped`);
  return new NextResponse("ok");
}
