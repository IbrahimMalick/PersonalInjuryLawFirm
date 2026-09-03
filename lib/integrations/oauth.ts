// Shared OAuth2 plumbing for CRM providers that don't offer pasteable tokens
// (Lawmatics, MyCase). The platform holds one developer app per provider
// (client id/secret in env); each firm clicks Connect, approves, and we store
// their token set in the integration's config.

import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { integrations, type IntegrationRow } from "../db/schema";
import type { IntegrationConfig } from "./types";
import { str } from "./types";

export interface OAuthProviderSpec {
  provider: "lawmatics" | "mycase";
  authorizeUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scope?: string;
}

export const OAUTH_SPECS: Record<"lawmatics" | "mycase", OAuthProviderSpec> = {
  lawmatics: {
    provider: "lawmatics",
    authorizeUrl: "https://app.lawmatics.com/oauth/authorize",
    tokenUrl: "https://api.lawmatics.com/oauth/token",
    clientIdEnv: "LAWMATICS_CLIENT_ID",
    clientSecretEnv: "LAWMATICS_CLIENT_SECRET",
  },
  mycase: {
    provider: "mycase",
    authorizeUrl: "https://auth.mycase.com/login_sessions/new",
    tokenUrl: "https://auth.mycase.com/tokens",
    clientIdEnv: "MYCASE_CLIENT_ID",
    clientSecretEnv: "MYCASE_CLIENT_SECRET",
  },
};

export function platformAppConfigured(spec: OAuthProviderSpec): boolean {
  return Boolean(process.env[spec.clientIdEnv] && process.env[spec.clientSecretEnv]);
}

export function redirectUri(provider: string): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/integrations/${provider}/callback`;
}

export function buildAuthorizeUrl(spec: OAuthProviderSpec, state: string): string {
  const url = new URL(spec.authorizeUrl);
  url.searchParams.set("client_id", process.env[spec.clientIdEnv] ?? "");
  url.searchParams.set("redirect_uri", redirectUri(spec.provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  if (spec.scope) url.searchParams.set("scope", spec.scope);
  return url.toString();
}

export function newOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  /** epoch ms; 0 = unknown, treat as fresh */
  expiresAt: number;
}

function parseTokenResponse(body: Record<string, unknown>): TokenSet {
  const access = body.access_token;
  if (typeof access !== "string" || !access) throw new Error("Token response had no access_token");
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : null;
  return {
    accessToken: access,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
    expiresAt: expiresIn ? Date.now() + (expiresIn - 60) * 1000 : 0,
  };
}

export async function exchangeCode(spec: OAuthProviderSpec, code: string): Promise<TokenSet> {
  const res = await fetch(spec.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env[spec.clientIdEnv] ?? "",
      client_secret: process.env[spec.clientSecretEnv] ?? "",
      redirect_uri: redirectUri(spec.provider),
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`${spec.provider} token exchange ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return parseTokenResponse((await res.json()) as Record<string, unknown>);
}

async function refresh(spec: OAuthProviderSpec, refreshToken: string): Promise<TokenSet> {
  const res = await fetch(spec.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env[spec.clientIdEnv] ?? "",
      client_secret: process.env[spec.clientSecretEnv] ?? "",
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`${spec.provider} token refresh ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return parseTokenResponse((await res.json()) as Record<string, unknown>);
}

export function hasTokens(config: IntegrationConfig): boolean {
  return Boolean(str(config, "accessToken"));
}

/** Returns a live access token, refreshing and persisting when expired. */
export async function liveAccessToken(
  spec: OAuthProviderSpec,
  integration: IntegrationRow
): Promise<string> {
  const config = integration.config;
  const access = str(config, "accessToken");
  const expiresAt = typeof config.expiresAt === "number" ? config.expiresAt : 0;
  if (access && (expiresAt === 0 || expiresAt > Date.now())) return access;

  const refreshToken = str(config, "refreshToken");
  if (!refreshToken) throw new Error(`${spec.provider} token expired and no refresh token stored`);
  const fresh = await refresh(spec, refreshToken);
  const db = await getDb();
  await db
    .update(integrations)
    .set({
      config: {
        ...config,
        accessToken: fresh.accessToken,
        refreshToken: fresh.refreshToken ?? refreshToken,
        expiresAt: fresh.expiresAt,
      },
    })
    .where(eq(integrations.id, integration.id));
  return fresh.accessToken;
}
