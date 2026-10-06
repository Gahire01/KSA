import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import type { Role } from "@/lib/types";

/**
 * Referral codes.
 *
 * These attribute a trainer or signup to whoever sent them, so unlike an access-link
 * token they are **stored in the clear**: the academy needs to read "which trainer
 * brought this cohort in", and a referral code is not a credential. It cannot sign
 * anyone in — it only travels alongside an access link.
 *
 * The alphabet omits I, O, 0 and 1 so a code read aloud over the phone or copied off
 * a whiteboard cannot be mistyped into a code that resolves to somebody else's
 * account. The exact collisions matter more than the entropy here: at 8 characters
 * from a 32-symbol alphabet that is 40 bits, far past brute-force range, and this
 * table is indexed unique.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REFERRAL_CODE_LENGTH = 8;
export const REFERRAL_DEFAULT_DAYS = 60;
export const REFERRAL_MAX_DAYS = 365;

function randomCode(length = REFERRAL_CODE_LENGTH): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export interface MintReferralCodeInput {
  createdById: string;
  role: Role;
  trainerId?: string | null;
  maxUses?: number;
  expiresInDays?: number;
}

export async function mintReferralCode(input: MintReferralCodeInput) {
  const maxUses = Math.min(Math.max(input.maxUses ?? 1, 1), 500);
  const days = Math.min(
    Math.max(input.expiresInDays ?? REFERRAL_DEFAULT_DAYS, 1),
    REFERRAL_MAX_DAYS,
  );
  const expiresAt = new Date(Date.now() + days * 86_400_000);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();

    try {
      return await prisma.referralCode.create({
        data: {
          code,
          role: input.role,
          trainerId: input.trainerId ?? null,
          maxUses,
          expiresAt,
          createdById: input.createdById,
        },
      });
    } catch (error) {
      const clash =
        typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
      if (!clash) throw error;
    }
  }

  throw new Error("Could not allocate a referral code after 5 attempts.");
}

/**
 * Spends one use of a referral code.
 *
 * This has to be one atomic statement, not a read followed by a write. `maxUses` is a
 * column on the same row as `timesUsed`, and Prisma's filter API cannot compare two
 * columns against each other — so a read-then-write would let two simultaneous
 * sign-ups both observe "one use left" and both be admitted, overshooting the cap.
 *
 * The conditional `UPDATE ... WHERE "timesUsed" < "maxUses" RETURNING` puts the check
 * and the increment in the same row lock, so the loser of the race updates zero rows
 * and is correctly rejected.
 */
export async function consumeReferralCode(code: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "ReferralCode"
       SET "timesUsed" = "timesUsed" + 1
     WHERE code = ${normaliseReferralCode(code)}
       AND "timesUsed" < "maxUses"
       AND "expiresAt" > NOW()
    RETURNING id
  `;

  return rows.length > 0;
}

export function normaliseReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
