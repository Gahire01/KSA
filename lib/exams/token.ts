import { createHash, randomBytes, randomInt } from "node:crypto";

/**
 * Exam-link tokens and one-time codes.
 *
 * The plain token only ever exists in the email and in the database row's
 * `tokenHash` never as plaintext — see `hashExamToken`. That means a leaked
 * database cannot be replayed as an exam link, and an emailed link that leaks
 * cannot be enumerated back into a different attempt.
 */

const TOKEN_BYTES = 32;

/** 32 bytes, base64url — 43 characters, no padding. */
export function generateExamToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * SHA-256 is enough here (unlike the low-entropy OTP, which gets argon2id):
 * the input already carries 256 bits of entropy, so there is nothing to brute
 * force and a fast digest keeps the verify path cheap.
 */
export function hashExamToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Six digits, uniform — `randomInt` is a CSPRNG and rejects modulo bias. */
export function generateOtp(): string {
  return randomInt(100_000, 1_000_000).toString();
}

export const OTP_TTL_MINUTES = 30;
export const OTP_MAX_ATTEMPTS = 5;

/** Resend a fresh code only this often, per token. */
export const OTP_RESEND_LIMIT = 3;
export const OTP_RESEND_WINDOW_MS = 60 * 60 * 1000;

export function otpExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + OTP_TTL_MINUTES * 60 * 1000);
}