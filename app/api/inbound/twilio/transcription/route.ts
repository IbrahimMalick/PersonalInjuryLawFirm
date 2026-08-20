import { NextResponse } from "next/server";
import { handleTranscription, verifyTwilioSignature } from "@/lib/channels/twilio";

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
  await handleTranscription(params);
  return new NextResponse("ok");
}
