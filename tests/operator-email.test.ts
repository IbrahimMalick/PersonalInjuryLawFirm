import { describe, expect, it } from "vitest";
import { isOperator, isOperatorEmail } from "../lib/auth";
import type { UserRow } from "../lib/db/schema";

// isOperatorEmail / isOperator (lib/auth.ts) — Pre-Launch Audit blocker 1.
// A customer-controlled form (signup, Settings -> Add user) could previously
// mint a user with an email string that happened to match OPERATOR_EMAILS,
// and isOperator() would grant full platform access on that string match
// alone. The fix is two-layered: isOperatorEmail() lets account-creation
// paths reject a reserved address outright, and isOperator() independently
// requires emailVerifiedAt, so even a reserved address let through some
// other way can't gain operator access until its inbox is proven owned.

const user = (over: Partial<UserRow>): UserRow =>
  ({
    id: 1,
    firmId: 1,
    email: "op@example.com",
    name: "Op",
    passwordHash: "x",
    role: "admin",
    emailVerifiedAt: null,
    disabledAt: null,
    totpSecret: null,
    totpEnabledAt: null,
    totpBackupCodes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as UserRow;

describe("isOperatorEmail", () => {
  it("matches an address in OPERATOR_EMAILS, case- and whitespace-insensitively", () => {
    process.env.OPERATOR_EMAILS = " Op@Example.com , other@x.com";
    expect(isOperatorEmail("op@example.com")).toBe(true);
    expect(isOperatorEmail("  OP@EXAMPLE.COM  ")).toBe(true);
    expect(isOperatorEmail("other@x.com")).toBe(true);
  });

  it("does not match an address outside the list", () => {
    process.env.OPERATOR_EMAILS = "op@example.com";
    expect(isOperatorEmail("customer@firm.com")).toBe(false);
  });

  it("matches nothing when OPERATOR_EMAILS is unset", () => {
    delete process.env.OPERATOR_EMAILS;
    expect(isOperatorEmail("op@example.com")).toBe(false);
  });
});

describe("isOperator", () => {
  it("grants operator status only once the address is both reserved AND verified", () => {
    process.env.OPERATOR_EMAILS = "op@example.com";
    expect(isOperator(user({ email: "op@example.com", emailVerifiedAt: "2026-01-01T00:00:00.000Z" }))).toBe(true);
  });

  it("refuses an unverified account, even with a reserved address", () => {
    process.env.OPERATOR_EMAILS = "op@example.com";
    expect(isOperator(user({ email: "op@example.com", emailVerifiedAt: null }))).toBe(false);
  });

  it("refuses a verified account whose address isn't reserved", () => {
    process.env.OPERATOR_EMAILS = "op@example.com";
    expect(isOperator(user({ email: "customer@firm.com", emailVerifiedAt: "2026-01-01T00:00:00.000Z" }))).toBe(false);
  });
});
