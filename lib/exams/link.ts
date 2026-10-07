/**
 * Exam link lifecycle rules. Pure (no server imports) so the exam page can use
 * the same copy the API returns.
 *
 * A link is usable while it has not expired and has uses left. Opening means
 * redeeming the OTP once; after that only the signed exam-session cookie lets
 * the same trainee resume. The copy never says why in more detail than this.
 */

export const LINK_DEFAULT_HOURS = 72;
export const LINK_MAX_HOURS = 720;
export const LINK_EXTEND_HOURS = 24;

export const LINK_EXPIRED_MESSAGE =
  "This exam link has expired. Please contact Kigali Safety Academy to receive a new link.";
export const LINK_USED_MESSAGE =
  "This link has already been opened. If you need to retake the exam, contact the academy.";

export type LinkState = "ok" | "expired" | "used";

export interface LinkFields {
  linkExpiresAt: Date | null;
  linkUses: number;
  linkMaxUses: number;
}

/**
 * A null expiry (an attempt created before the lifecycle existed) counts as
 * expired: staff can extend it, which is safer than leaving it open forever.
 */
export function linkState(attempt: LinkFields, now: Date = new Date()): LinkState {
  if (!attempt.linkExpiresAt || attempt.linkExpiresAt.getTime() <= now.getTime()) return "expired";
  if (attempt.linkUses >= attempt.linkMaxUses) return "used";
  return "ok";
}

export function linkExpiryFromNow(hours: number, now: Date = new Date()): Date {
  const clamped = Math.min(LINK_MAX_HOURS, Math.max(1, Math.floor(hours)));
  return new Date(now.getTime() + clamped * 60 * 60 * 1000);
}
