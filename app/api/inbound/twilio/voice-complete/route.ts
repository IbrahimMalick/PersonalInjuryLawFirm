import { NextResponse } from "next/server";
import { verifyTwilioSignature } from "@/lib/channels/twilio";
import { enqueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

// Fires when the recording finishes. The transcription callback usually
// creates the lead; this schedules a safety-net job in case it never arrives.
export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") params[k] = v;
  });
  if (!(await verifyTwilioSignature(request, params))) {
    return new NextResponse("invalid signature", { status: 403 });
  }
  if (params.RecordingUrl && params.CallSid) {
    await enqueue(
      "transcribe_voicemail",
      {
        callSid: params.CallSid,
        recordingUrl: params.RecordingUrl,
        from: params.From ?? params.Caller,
        durationSec: params.RecordingDuration ? Number(params.RecordingDuration) : undefined,
      },
      { delaySeconds: 180 } // give the transcription callback time to win the race
    );
  }
  const bye = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say voice="Polly.Joanna">Thank you. A member of our team will be in touch. Goodbye.</Say></Response>`;
  return new NextResponse(bye, { headers: { "Content-Type": "text/xml" } });
}
