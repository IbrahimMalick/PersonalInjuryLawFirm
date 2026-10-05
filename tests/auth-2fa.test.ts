import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The DB-backed half of two-factor login: the auth_tokens challenge that
// hands off between "password verified" and "code verified"
// (app/login/page.tsx → app/login/2fa/page.tsx). Real embedded Postgres
// (PGlite in a temp dir), same as the pipeline tests — this is the part of
// 2FA that's actually DB logic, as opposed to lib/totp.ts's pure math
// (tests/totp.test.ts) or the Next.js request-scoped cookie/page glue, which
// isn't unit-testable outside a real request (same limitation as every other
// page-level server action in this codebase — untested directly, exercised
// by hand, same as setOutcome/addNote/dismissOnboarding always have been).

type Db = Awaited<ReturnType<typeof import("../lib/db").getDb>>;
let db: Db;
let tables: typeof import("../lib/db").tables;
let issueToken: typeof import("../lib/auth-tokens").issueToken;
let peekToken: typeof import("../lib/auth-tokens").peekToken;
let redeemToken: typeof import("../lib/auth-tokens").redeemToken;
let createFirm: typeof import("../lib/firm").createFirm;
let userId: number;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nightshift-pg-2fa-"));

beforeAll(async () => {
  process.env.PGLITE_DIR = tmp;
  delete process.env.DATABASE_URL;
  const dbMod = await import("../lib/db");
  db = await dbMod.getDb();
  tables = dbMod.tables;
  ({ issueToken, peekToken, redeemToken } = await import("../lib/auth-tokens"));
  ({ createFirm } = await import("../lib/firm"));

  const firm = await createFirm("Reyes Injury", "", "personal_injury");
  const [row] = await db
    .insert(tables.users)
    .values({ firmId: firm.id, email: "ana@reyes.test", name: "Ana", passwordHash: "x", role: "admin" })
    .returning({ id: tables.users.id });
  userId = row.id;
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("two_factor_challenge tokens", () => {
  it("peeking finds the right user without consuming it — a wrong code can be retried", async () => {
    const token = await issueToken(userId, "two_factor_challenge");
    expect(await peekToken(token, "two_factor_challenge")).toBe(userId);
    expect(await peekToken(token, "two_factor_challenge")).toBe(userId); // still there
  });
  it("redeeming consumes it — a second peek (or redeem) finds nothing", async () => {
    const token = await issueToken(userId, "two_factor_challenge");
    expect(await redeemToken(token, "two_factor_challenge")).toBe(userId);
    expect(await peekToken(token, "two_factor_challenge")).toBeNull();
    expect(await redeemToken(token, "two_factor_challenge")).toBeNull();
  });
  it("an expired challenge is invisible to both peek and redeem", async () => {
    const token = "expired-2fa-token";
    await db.insert(tables.authTokens).values({
      token,
      userId,
      purpose: "two_factor_challenge",
      expiresAt: new Date(Date.now() - 1000).toISOString(), // already passed
    });
    expect(await peekToken(token, "two_factor_challenge")).toBeNull();
    expect(await redeemToken(token, "two_factor_challenge")).toBeNull();
  });
  it("a token issued for a different purpose doesn't match a 2FA peek — the purposes don't leak into each other", async () => {
    const resetToken = await issueToken(userId, "reset_password");
    expect(await peekToken(resetToken, "two_factor_challenge")).toBeNull();
    expect(await peekToken(resetToken, "reset_password")).toBe(userId);
  });
  it("an unknown token is invisible", async () => {
    expect(await peekToken("not-a-real-token", "two_factor_challenge")).toBeNull();
  });
});
