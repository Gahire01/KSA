import { randomInt } from "node:crypto";
import type { NextRequest } from "next/server";

import { clientKey, LOGIN_LIMIT, rateLimit, rateLimitHit } from "@/lib/api/rate-limit";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { loginSchema } from "@/lib/api/schemas";
import { hashSecret, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { sendLoginOtpEmail, OTP_EXPIRY_MINUTES } from "@/lib/email/templates";

/** Consecutive failures that trip the lockout. */
const LOCKOUT_THRESHOLD = 10;

/**
 * What every bad-credential answer says. "No such account" and "wrong
 * password" are the same sentence on purpose: a caller must not be able to use
 * this route to learn which addresses have accounts.
 */
const INVALID_CREDENTIALS = "Invalid email or password";

/**
 * Full argon2id work over a hash nobody can match, used when the address has
 * no account. Without it, a missing account answers in a millisecond and a real
 * one in ~50ms, which is all an enumeration needs.
 */
const DUMMY_HASH = "argon2id$placeholder";

function minutesFrom(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

/** RFC 6585 429, carrying the wait so the client can count it down. */
function tooManyAttempts(retryAfterSeconds: number, message: string) {
  const response = apiFail(message, 429);
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

/**
 * POST /api/auth/login — email + password, first half of the email-OTP flow.
 *
 * On success nothing is granted yet: a six-digit code is written to
 * `LoginOtp` (argon2id, 10 minutes) and emailed. The response says only that
 * the next step is `email-otp` — never the code, never a user id. The session
 * itself is minted by /api/auth/login/verify once that code comes back.
 */
export async function POST(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    return apiFail(zodMessage(parsed.error), 400);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  /* Two independent limits: per-IP stops one host spraying many accounts, and
   * per-account stops a distributed attempt on a single address. The IP bucket
   * is charged for every request — a limiter that only charges failures would
   * let a caller keep probing until something answers differently. */
  const ipKey = clientKey(request, "login:ip");
  const perIp = rateLimit(ipKey, LOGIN_LIMIT.perIp, LOGIN_LIMIT.windowMs);
  if (!perIp.ok) {
    return tooManyAttempts(
      perIp.retryAfterSeconds,
      `Too many sign-in attempts from this network. Try again in ${minutesFrom(perIp.retryAfterSeconds)} minute(s).`,
    );
  }

  const accountKey = `login:account:${email}`;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await verifyPassword(DUMMY_HASH, password);
    rateLimitHit(accountKey, LOGIN_LIMIT.perAccount, LOGIN_LIMIT.windowMs);
    return apiFail(INVALID_CREDENTIALS, 401);
  }

  const ok = await verifyPassword(user.passwordHash, password);

  if (!ok) {
    const failedLogins = user.failedLogins + 1;
    const locked = failedLogins >= LOCKOUT_THRESHOLD;

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins, ...(locked ? { lockedAt: new Date() } : {}) },
    });

    rateLimitHit(accountKey, LOGIN_LIMIT.perAccount, LOGIN_LIMIT.windowMs);
    return apiFail(INVALID_CREDENTIALS, 401);
  }

  if (!user.isActive) {
    return apiFail("Account disabled. Contact the academy.", 403);
  }

  /* A locked account stays locked until an owner clears it — waiting does not
   * help the attacker, so there is no time-based unlock to abuse. Checked after
   * the password so the lock state is never revealed to somebody who does not
   * already know the credentials. */
  if (user.lockedAt) {
    return apiFail(
      "This account is locked. Contact the academy owner to have it unlocked.",
      423,
    );
  }

  /* Checked only once the credentials are proven, so a wrong-password spray
   * cannot lock the real owner out of their own account. */
  const perAccount = rateLimit(accountKey, LOGIN_LIMIT.perAccount, LOGIN_LIMIT.windowMs);
  if (!perAccount.ok) {
    return tooManyAttempts(
      perAccount.retryAfterSeconds,
      `Too many sign-in attempts for this account. Try again in ${minutesFrom(perAccount.retryAfterSeconds)} minute(s).`,
    );
  }

  /* A proven password clears the address's own failure budget. */
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });

  /* Single active code: whatever was outstanding is replaced, so an older mail
   * can never be redeemed after a newer one was requested. */
  await prisma.loginOtp.deleteMany({ where: { userId: user.id } });

  const code = randomInt(100000, 999999).toString().padStart(6, "0");
  const codeHash = await hashSecret(code);

  await prisma.loginOtp.create({
    data: {
      userId: user.id,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000),
    },
  });

  try {
    await sendLoginOtpEmail({
      code,
      expiryMinutes: OTP_EXPIRY_MINUTES,
      recipientEmail: user.email,
    });
  } catch (error) {
    /* The code never reached anybody, so it must not stay redeemable either:
     * a 500 that left a live row would mean the "failed" sign-in still works
     * for ten minutes if the attacker already has the password. */
    await prisma.loginOtp.deleteMany({ where: { userId: user.id, codeHash } }).catch(() => {});
    /* Server-side only. `sendEmail` deliberately reports status, never the
     * message body, so this line cannot carry the code or the address. */
    console.error("[login-otp] sign-in code email failed", error);
    return apiFail("Could not send code. Try again in a moment.", 500);
  }

  return apiOk({ nextStep: "email-otp", email: user.email });
}
