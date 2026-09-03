import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { apiUser } from "@/lib/auth";
import { getDb, tables } from "@/lib/db";
import { exchangeCode, OAUTH_SPECS } from "@/lib/integrations/oauth";

export const dynamic = "force-dynamic";

// OAuth callback: verify the state nonce stored on the integration row, swap
// the code for tokens, and store them in the row's config.

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

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/settings/integrations?error=${reason}`, request.url));
  if (!code || !state) return fail(`${provider}-denied`);

  const db = await getDb();
  const row = (
    await db
      .select()
      .from(tables.integrations)
      .where(
        and(
          eq(tables.integrations.firmId, user.firmId),
          eq(tables.integrations.provider, provider)
        )
      )
      .limit(1)
  )[0];
  if (!row || row.config.oauthState !== state) return fail(`${provider}-state`);

  try {
    const tokens = await exchangeCode(OAUTH_SPECS[provider], code);
    await db
      .update(tables.integrations)
      .set({
        config: {
          ...row.config,
          oauthState: undefined,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          connectedBy: user.email,
          connectedAt: new Date().toISOString(),
        },
        enabled: true,
        lastError: null,
      })
      .where(eq(tables.integrations.id, row.id));
    await audit("integration.connected", {
      firmId: user.firmId,
      userId: user.id,
      detail: { provider },
    });
    return NextResponse.redirect(
      new URL(`/settings/integrations?connected=${provider}`, request.url)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(tables.integrations)
      .set({ lastError: message.slice(0, 1000) })
      .where(eq(tables.integrations.id, row.id));
    return fail(`${provider}-exchange`);
  }
}
