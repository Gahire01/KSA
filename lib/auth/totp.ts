import { randomBytes } from "node:crypto";

import { generateSecret, generateURI, verify } from "otplib";

import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const TOTP_ISSUER = "Kigali Safety Academy";

/** SHA1/6 digits/30s is what Google Authenticator and Authy expect. */
const TOTP_OPTIONS = {
  algorithm: "sha1",
  digits: 6,
  period: 30,
} as const;

/**
 * Accepts the current 30s step and the one before it, to tolerate clock skew.
 * Written as a [back, forward] pair: one step of slack backwards, none forwards,
 * so a code from the future cannot be replayed.
 */
const EPOCH_TOLERANCE: [number, number] = [TOTP_OPTIONS.period, 0];

export const RECOVERY_CODE_COUNT = 10;

export function generateTotpSecret(): string {
  return generateSecret();
}

/** `label` is the account name only — otplib prefixes the issuer itself. */
export function buildOtpAuthUri(secret: string, email: string): string {
  return generateURI({
    secret,
    label: email,
    issuer: TOTP_ISSUER,
    ...TOTP_OPTIONS,
  });
}

/**
 * Verifies a code and reports the time step it matched, so the caller can store
 * it and refuse that step a second time.
 *
 * `afterTimeStep` rejects any code at or below the stored counter, which is what
 * stops a shoulder-surfed code from being replayed inside its 30-second window.
 * Returns the new counter on success, or null when the code is not acceptable.
 */
export async function verifyTotp(params: {
  token: string;
  secret: string;
  afterTimeStep?: number;
}): Promise<number | null> {
  const token = params.token.replace(/\D/g, "");
  if (token.length !== TOTP_OPTIONS.digits) return null;

  try {
    /* `otplib` re-exports the HOTP and TOTP results as one union and only the
     * TOTP variant carries `timeStep`. These options (period/epochTolerance/
     * afterTimeStep) always take the TOTP path, so narrow to that shape. */
    const result = (await verify({
      token,
      secret: params.secret,
      epochTolerance: EPOCH_TOLERANCE,
      ...(params.afterTimeStep !== undefined
        ? { afterTimeStep: params.afterTimeStep }
        : {}),
    })) as { valid: true; timeStep: number } | { valid: false };

    return result.valid ? result.timeStep : null;
  } catch {
    return null;
  }
}

/**
 * Single-use codes, formatted XXXX-XXXX-XXXX so they can be transcribed from a
 * printout. Returned in plaintext once, at setup time — only hashes are stored.
 */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  const codes: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const bytes = randomBytes(12);
    const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
    codes.push(`${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars
      .slice(8, 12)
      .join("")}`);
  }

  return codes;
}

export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => hashPassword(code)));
}

/** Normalises user input before a recovery-code lookup (case/spacing agnostic). */
export function normaliseRecoveryCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export async function checkRecoveryCode(
  codeHashes: Array<{ id: string; codeHash: string; usedAt: Date | null }>,
  input: string,
): Promise<string | null> {
  const candidate = normaliseRecoveryCode(input);

  for (const row of codeHashes) {
    if (row.usedAt) continue;
    /* The stored hash is of the formatted code; compare both shapes. */
    const matches =
      (await verifyPassword(row.codeHash, candidate)) ||
      (await verifyPassword(row.codeHash, formatRecoveryCode(candidate)));

    if (matches) return row.id;
  }

  return null;
}

function formatRecoveryCode(flat: string): string {
  if (flat.length !== 12) return flat;
  return `${flat.slice(0, 4)}-${flat.slice(4, 8)}-${flat.slice(8, 12)}`;
}
