import { NextResponse } from "next/server";
import { verifyTwilioSignature, voicemailTwiml } from "@/lib/channels/twilio";
import { getFirm } from "@/lib/firm";

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
  const firm = await getFirm();
  return new NextResponse(voicemailTwiml(firm.name), {
    headers: { "Content-Type": "text/xml" },
  });
}
