import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import {
  consumeBackupCode,
  generateBackupCodes,
  generateSecret,
  hashBackupCodes,
  provisioningUri,
  verifyTotp,
} from "../lib/totp";

// Two-factor login (lib/totp.ts) — the RFC 6238 math itself comes from
// otpauth, a well-reviewed library; these tests exercise OUR wrapper (the
// validation, the trust boundary around what counts as a match) rather than
// re-proving TOTP's own correctness.

function codeFor(secret: string, at: Date = new Date()): string {
  return OTPAuth.TOTP.generate({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    timestamp: at.getTime(),
  });
}

describe("generateSecret", () => {
  it("returns a non-trivial, unique base32 string each time", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
    expect(a).toMatch(/^[A-Z2-7]+=*$/); // base32 alphabet
  });
});

describe("provisioningUri", () => {
  it("is an otpauth:// URI carrying the issuer and the account label", () => {
    const uri = provisioningUri(generateSecret(), "Reyes Injury: ana@reyes.test");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("Nightshift");
    expect(decodeURIComponent(uri)).toContain("ana@reyes.test");
  });
});

describe("verifyTotp", () => {
  it("accepts the current code for the secret", () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, codeFor(secret))).toBe(true);
  });
  it("rejects a code for a different secret", () => {
    const secret = generateSecret();
    const other = generateSecret();
    expect(verifyTotp(secret, codeFor(other))).toBe(false);
  });
  it("accepts a code one 30-second step off (clock drift), rejects two steps off", () => {
    const secret = generateSecret();
    const oneStepAgo = new Date(Date.now() - 30_000);
    const twoStepsAgo = new Date(Date.now() - 60_000);
    expect(verifyTotp(secret, codeFor(secret, oneStepAgo))).toBe(true);
    expect(verifyTotp(secret, codeFor(secret, twoStepsAgo))).toBe(false);
  });
  it("rejects anything that isn't exactly 6 digits, including empty and non-numeric input", () => {
    const secret = generateSecret();
    for (const bad of ["", "12345", "1234567", "abcdef", " 123456 extra", "123 456"]) {
      expect(verifyTotp(secret, bad)).toBe(false);
    }
  });
  it("tolerates surrounding whitespace in an otherwise valid code", () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, `  ${codeFor(secret)}  `)).toBe(true);
  });
});

describe("backup codes", () => {
  it("generates the requested count, all distinct", () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });
  it("hashes never equal the plaintext, and a match returns the list with that code removed", async () => {
    const codes = generateBackupCodes(2);
    const hashed = await hashBackupCodes(codes);
    expect(hashed[0]).not.toBe(codes[0]);

    const remaining = await consumeBackupCode(hashed, codes[0]);
    expect(remaining).toEqual([hashed[1]]);
    // consumeBackupCode is pure — it's the CALLER's job to persist `remaining`
    // so the same code can't be used twice (see app/login/2fa/page.tsx, which
    // writes the returned list back to the user row).
  });
  it("rejects a code that was never issued, and is case/whitespace-insensitive on a real one", async () => {
    const codes = generateBackupCodes(3);
    const hashed = await hashBackupCodes(codes);
    expect(await consumeBackupCode(hashed, "not-a-real-code")).toBeNull();
    const match = await consumeBackupCode(hashed, `  ${codes[1].toUpperCase()}  `);
    expect(match).not.toBeNull();
    expect(match).toHaveLength(2);
  });
});
