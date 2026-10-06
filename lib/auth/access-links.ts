import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/email/send";
import type { Role } from "@/lib/types";

/**
 * Shareable sign-in links.
 *
 * ## The plain token exists exactly once
 *
 * `mintAccessLink` returns the plaintext link and stores only `tokenHash`, a SHA-256
 * digest. There is no code path anywhere that can reproduce the plaintext from the
 * database, because that is the property that matters: a leaked backup, a stray
 * `SELECT`, or an owner scrolling the audit log cannot leak a working invite.
 *
 * The cost is real and accepted — a lost link cannot be recovered, only replaced. An
 * owner mints a new one. Storing the plaintext "just in case" would make the whole
 * exercise decorative.
 *
 * ## Why SHA-256 here but argon2 for the OTP
 *
 * The token is 32 bytes of `crypto.randomBytes`: there is no dictionary to guess and
 * nothing to brute-force at any feasible rate, so it is already high-entropy and a
 * slow KDF would only add latency to every sign-in. Argon2 is for low-entropy
 * *human-chosen* secrets, like the OTP and the password, where the attacker gets
 * unlimited guesses.
 */

export const ACCESS_LINK_DEFAULT_DAYS = 14;
export const ACCESS_LINK_MAX_DAYS = 90;

/** A referral code is short and human-typed, so its alphabet excludes look-alikes. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface MintAccessLinkInput {
  createdById: string;
  role: Role;
  trainerId?: string | null;
  label?: string | null;
  expiresInDays?: number;
  singleUse?: boolean;
}

export interface MintedAccessLink {
  id: string;
  /** Shown to the owner once and never recoverable again. */
  url: string;
  token: string;
  referralCode: string;
  expiresAt: Date;
  singleUse: boolean;
}

function randomReferralCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Mints a link and its companion referral code.
 *
 * Both are stored as digests/hashed forms where they are secrets. The referral code
 * is stored in the clear on the link because it is an attribution label the owner
 * needs to read in a report, not a credential.
 */
export async function mintAccessLink(input: MintAccessLinkInput): Promise<MintedAccessLink> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const days = Math.min(Math.max(input.expiresInDays ?? ACCESS_LINK_DEFAULT_DAYS, 1), ACCESS_LINK_MAX_DAYS);
  const expiresAt = new Date(Date.now() + days * 86_400_000);

  /* The referral code is unique, so retry on the (very unlikely) clash. */
  let referralCode = "";
  let link: { id: string; referralCode: string } | null = null;

  for (let attempt = 0; attempt < 5 && !link; attempt += 1) {
    referralCode = randomReferralCode();

    try {
      link = await prisma.accessLink.create({
        data: {
          tokenHash,
          referralCode,
          role: input.role,
          trainerId: input.trainerId ?? null,
          label: input.label?.trim() || null,
          expiresAt,
          singleUse: input.singleUse ?? false,
          createdById: input.createdById,
        },
        select: { id: true, referralCode: true },
      });
    } catch (error) {
      const clash =
        typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
      if (!clash) throw error;
    }
  }

  if (!link) {
    throw new Error("Could not allocate a referral code after 5 attempts.");
  }

  return {
    id: link.id,
    token,
    referralCode: link.referralCode,
    url: appUrl(`/access/${token}`),
    expiresAt,
    singleUse: input.singleUse ?? false,
  };
}

export type AccessLinkStatus = "ACTIVE" | "USED" | "EXPIRED" | "REVOKED";

/**
 * Resolves a plaintext token to its link.
 *
 * Returns a discriminated result rather than null so the caller can tell "this link
 * never existed" from "this link was withdrawn" — a revoked link should say so,
 * because silently reporting an expired-or-revoked link as invalid would leave the
 * recipient unable to tell a typo from a revoked invitation.
 */
export async function resolveAccessLink(
  token: string,
): Promise<
  | { ok: true; link: { id: string; role: Role; trainerId: string | null; singleUse: boolean; expiresAt: Date; revokedAt: Date | null; usedAt: Date | null } }
  | { ok: false; status: AccessLinkStatus | "UNKNOWN" }
> {
  if (!token) return { ok: false, status: "UNKNOWN" };

  const link = await prisma.accessLink.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      role: true,
      trainerId: true,
      singleUse: true,
      expiresAt: true,
      revokedAt: true,
      usedAt: true,
    },
  });

  if (!link) return { ok: false, status: "UNKNOWN" };
  if (link.revokedAt) return { ok: false, status: "REVOKED" };
  if (link.usedAt) return { ok: false, status: "USED" };
  if (link.expiresAt <= new Date()) return { ok: false, status: "EXPIRED" };

  return { ok: true, link };
}

/**
 * Marks a single-use link as spent.
 *
 * `updateMany` with the `usedAt: null` guard makes this a compare-and-set: two
 * simultaneous redemptions of the same single-use link cannot both succeed, so the
 * loser is told it is already used rather than both getting in.
 */
export async function consumeAccessLink(linkId: string): Promise<boolean> {
  const result = await prisma.accessLink.updateMany({
    where: { id: linkId, usedAt: null, revokedAt: null },
    data: { usedAt: new Date() },
  });

  return result.count > 0;
}

export async function revokeAccessLink(id: string): Promise<boolean> {
  const result = await prisma.accessLink.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

export function accessLinkStatus(
  link: { expiresAt: Date; revokedAt: Date | null; usedAt: Date | null },
  now: Date = new Date(),
): AccessLinkStatus {
  if (link.revokedAt) return "REVOKED";
  if (link.usedAt) return "USED";
  if (link.expiresAt <= now) return "EXPIRED";
  return "ACTIVE";
}
