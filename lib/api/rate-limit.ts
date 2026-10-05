/**
 * Fixed-window in-memory rate limiter for the auth endpoints.
 *
 * Per-process only: with more than one instance this is per-instance, not
 * global. That is acceptable while the app runs on a single box; a
 * Postgres-backed limiter lands in Phase 3 as planned.
 */
import type { NextResponse } from "next/server";

import { apiFail, type ApiFailure } from "@/lib/api/response";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Sign-in limits. Both are checked, so neither a single host spraying many
 * addresses nor many hosts converging on one account gets a clean run.
 */
export const LOGIN_LIMIT = {
  perAccount: 5,
  perIp: 20,
  windowMs: WINDOW_MS,
} as const;

/** Second-factor guessing, counted per session rather than per IP. */
export const MFA_LIMIT = { perSession: 5, windowMs: WINDOW_MS } as const;

export const AUTH_LIMIT = { max: 5, windowMs: WINDOW_MS } as const;

const HOUR_MS = 60 * 60 * 1000;

/** OTP guessing on an exam link, counted against the token. */
export const OTP_VERIFY_LIMIT = { perToken: 5, perIp: 10, windowMs: WINDOW_MS } as const;

/** Issuing a fresh code is itself abusable, so it is capped per token per hour. */
export const OTP_RESEND_LIMIT = { perToken: 3, windowMs: HOUR_MS } as const;

/** Redeeming a link or code is an unauthenticated entry point. */
export const ACCESS_USE_LIMIT = { perIp: 10, windowMs: WINDOW_MS } as const;

export const REFERRAL_REDEEM_LIMIT = { perIp: 10, windowMs: WINDOW_MS } as const;

/** Exam autosave. Generous enough for a jittering client, tight enough to
 * stop a script using it to brute-force option ids. */
export const EXAM_AUTOSAVE_LIMIT = { max: 30, windowMs: 60 * 1000 } as const;

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

/** Best-effort client identity; proxies are not trusted in this phase. */
export function clientKey(request: Request, scope: string): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip =
    fwd?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

export function rateLimit(
  key: string,
  limit: number = AUTH_LIMIT.max,
  windowMs: number = AUTH_LIMIT.windowMs,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/** Keeps the Map from growing without bound across a long dev session. */
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Convenience wrapper returning a 429 the moment a bucket is full.
 *
 * `Retry-After` is set so a well-behaved client — and any future Redis-backed
 * replacement — has the remaining window without guessing.
 */
export function rateLimitFail(retryAfterSeconds: number): NextResponse<ApiFailure> {
  const response = apiFail("Too many attempts. Please wait and try again.", 429);
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

/** Convenience wrapper that reports the unblocked case. */
export function rateLimitPass(remaining: number): { ok: true; remaining: number } {
  return { ok: true, remaining };
}
