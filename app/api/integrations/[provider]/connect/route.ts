import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { upsertIntegration } from "@/lib/integrations";
import {
  buildAuthorizeUrl,
  newOAuthState,
  OAUTH_SPECS,
  platformAppConfigured,
} from "@/lib/integrations/oauth";

export const dynamic = "force-dynamic";

// Starts the OAuth connect flow for providers without pasteable tokens.
// Browser GET by a logged-in firm admin → redirect to the provider's consent
// screen; the state nonce is stored on the firm's integration row.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (provider !== "lawmatics" && provider !== "mycase") {
    return new NextResponse("unknown provider", { status: 404 });
  }
  const user = await apiUser("admin");
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const spec = OAUTH_SPECS[provider];
  if (!platformAppConfigured(spec)) {
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${provider}-not-enabled`, request.url)
    );
  }

  const state = newOAuthState();
  await upsertIntegration(user.firmId, provider, { config: { oauthState: state } });
  return NextResponse.redirect(buildAuthorizeUrl(spec, state));
}
