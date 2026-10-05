import crypto from "crypto";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";

// Two-factor authentication (TOTP, RFC 6238) for staff logins. Code-only —
// no new outbound call, no third-party dependency beyond two small, pure-JS
// libraries (otpauth for the RFC math, qrcode for the setup screen). The
// secret and backup codes never leave the server except once, at setup, to
// the account that just proved it owns the authenticator app.

const ISSUER = "Nightshift";
const BACKUP_CODE_COUNT = 10;

function totpFor(secretBase32: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function generateSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/** The otpauth:// URI an authenticator app scans (as a QR code) or imports directly. */
export function provisioningUri(secretBase32: string, accountLabel: string): string {
  const totp = totpFor(secretBase32);
  totp.label = accountLabel;
  return totp.toString();
}

/**
 * Checks a 6-digit code against the secret, allowing one 30-second step of
 * clock drift either way — tight enough to matter, loose enough that a phone
 * a few seconds off doesn't lock someone out.
 */
export function verifyTotp(secretBase32: string, token: string): boolean {
  const cleaned = token.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  return totpFor(secretBase32).validate({ token: cleaned, window: 1 }) !== null;
}

/** Ten single-use recovery codes, shown once at enrollment — the user's only way back in if they lose the device. */
export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString("hex"));
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
}

/**
 * Checks a code against the stored (hashed) backup codes. On a match, returns
 * the remaining hashed list with that one removed — single use, same as the
 * audit trail's "nothing here is reusable" posture. Returns null on no match.
 */
export async function consumeBackupCode(
  hashedCodes: string[],
  attempt: string
): Promise<string[] | null> {
  const cleaned = attempt.trim().toLowerCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(cleaned, hashedCodes[i])) {
      return [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
    }
  }
  return null;
}
