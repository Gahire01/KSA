import type { NextRequest } from "next/server";

import { clientKey, LOGIN_VERIFY_LIMIT, rateLimit } from "@/lib/api/rate-limit";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { loginVerifySchema } from "@/lib/api/schemas";
import { recordDevice } from "@/lib/auth/devices";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/** Failed verifications against one code before it is destroyed. */
const MAX_ATTEMPTS = 5;

/**
 * The only sentence a rejected code ever produces. Wrong, expired and
 * "there was never one" are deliberately indistinguishable: telling them apart
 * would tell an attacker holding a password whether a code had been issued,
 * how long ago, and therefore when a fresh one would land.
 */
const INVALID_CODE = "Invalid or expired code";

function minutesFrom(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

function tooManyAttempts(retryAfterSeconds: number, message: string) {
  const response = apiFail(message, 429);
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

/**
 * POST /api/auth/login/verify — second half of the email-OTP flow.
 *
 * Redeems the code issued by /api/auth/login. On success it is the session
 * minting step: the row is destroyed, a Session row and the httpOnly cookie are
 * created, and the answer is only `{ role, email, name }`. The code is never
 * echoed back, and every timestamp here is server time.
 */
export async function POST(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = loginVerifySchema.safeParse(raw);

  if (!parsed.success) {
    /* Format is checked before anything else, so a malformed code is a 400
     * whether or not an account exists — no lookup, no leak, no ambiguity. */
    return apiFail(zodMessage(parsed.error), 400);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const code = parsed.data.code;

  const ipKey = clientKey(request, "login-verify:ip");
  const perIp = rateLimit(ipKey, LOGIN_VERIFY_LIMIT.perIp, LOGIN_VERIFY_LIMIT.windowMs);
  if (!perIp.ok) {
    return tooManyAttempts(
      perIp.retryAfterSeconds,
      `Too many attempts from this network. Try again in ${minutesFrom(perIp.retryAfterSeconds)} minute(s).`,
    );
  }

  const emailKey = `login-verify:email:${email}`;
  const perEmail = rateLimit(emailKey, LOGIN_VERIFY_LIMIT.perEmail, LOGIN_VERIFY_LIMIT.windowMs);
  if (!perEmail.ok) {
    return tooManyAttempts(
      perEmail.retryAfterSeconds,
      `Too many attempts for this account. Try again in ${minutesFrom(perEmail.retryAfterSeconds)} minute(s).`,
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  /* Unknown address, disabled account, no code on file, expired code and a
   * wrong code all fall through to the same sentence and the same 401. */
  if (!user || !user.isActive) return apiFail(INVALID_CODE, 401);

  const otp = await prisma.loginOtp.findFirst({ where: { userId: user.id } });
  if (!otp) return apiFail(INVALID_CODE, 401);

  if (otp.expiresAt.getTime() <= Date.now()) {
    await prisma.loginOtp.deleteMany({ where: { id: otp.id } }).catch(() => {});
    return apiFail(INVALID_CODE, 401);
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    await prisma.loginOtp.deleteMany({ where: { id: otp.id } }).catch(() => {});
    return apiFail("Too many attempts. Request a new code.", 429);
  }

  const ok = await verifyPassword(otp.codeHash, code);

  if (!ok) {
    await prisma.loginOtp
      .update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
      .catch(() => {});
    return apiFail(INVALID_CODE, 401);
  }

  /* Redemed: the code is gone for good, so a replay — same browser, same
   * mailbox, stolen mail — finds nothing to verify against. */
  await prisma.loginOtp.deleteMany({ where: { userId: user.id } }).catch(() => {});

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");

  await createSession({ userId: user.id, mfaPassed: true, ip, userAgent });

  /* The session is bound to a device id (see lib/auth/devices.ts): without a
   * DeviceSession row for this browser, getSession() treats the cookie as a
   * copied half-credential and refuses it. */
  await recordDevice({ userId: user.id, ip, userAgent });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return apiOk({
    role: user.role,
    email: user.email,
    name: user.name || user.email.split("@")[0],
  });
}
