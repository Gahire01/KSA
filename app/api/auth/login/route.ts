import type { NextRequest } from "next/server";

import { clientKey, LOGIN_LIMIT, rateLimit } from "@/lib/api/rate-limit";
import { apiFail, apiOk } from "@/lib/api/response";
import { loginSchema } from "@/lib/api/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/** Consecutive failures that trip the lockout. */
const LOCKOUT_THRESHOLD = 10;

/** RFC 6585 429, carrying the wait so a client knows when to retry. */
function tooManyAttempts(retryAfterSeconds: number) {
  const response = apiFail(
    `Too many sign-in attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
    429,
  );
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

/**
 * POST /api/auth/login — email + password.
 *
 * Always reports "email or password is incorrect" for bad credentials so the
 * route cannot be used to enumerate which addresses have accounts.
 */
export async function POST(request: NextRequest) {
  /* Two independent limits: per-IP stops one host spraying many accounts, and
   * per-account stops a distributed attempt on a single address. Either one
   * alone leaves a gap. */
  const perIp = rateLimit(clientKey(request, "login:ip"), LOGIN_LIMIT.perIp);
  if (!perIp.ok) return tooManyAttempts(perIp.retryAfterSeconds);

  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return apiFail("Enter your email and password.", 422);
  }

  const { email, password } = parsed.data;
  const accountKey = `login:account:${email.toLowerCase()}`;

  const perAccount = rateLimit(accountKey, LOGIN_LIMIT.perAccount);
  if (!perAccount.ok) return tooManyAttempts(perAccount.retryAfterSeconds);

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  const invalid = apiFail("Email or password is incorrect.", 401);

  if (!user || !user.isActive) {
    /* Spend comparable time on a missing account so timing does not leak. */
    if (!user) await verifyPassword("argon2id$placeholder", password);
    return invalid;
  }

  /* A locked account stays locked until an owner clears it — waiting does not
   * help the attacker, so there is no time-based unlock to abuse. */
  if (user.lockedAt) {
    return apiFail(
      "This account is locked. Contact the academy owner to have it unlocked.",
      423,
    );
  }

  const ok = await verifyPassword(user.passwordHash, password);

  if (!ok) {
    const failedLogins = user.failedLogins + 1;
    const locked = failedLogins >= LOCKOUT_THRESHOLD;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins,
        ...(locked ? { lockedAt: new Date() } : {}),
      },
    });

    return invalid;
  }

  /* Phase 1 is single-tenant: only the owner may hold a session at all. */
  if (user.role !== "OWNER") {
    return apiFail("This system is restricted to the academy owner.", 403);
  }

  await createSession({
    userId: user.id,
    mfaPassed: false,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLogins: 0, lockedAt: null },
  });

  return apiOk({
    email: user.email,
    role: user.role,
    totpEnabled: user.totpEnabled,
    /** The client routes to TOTP setup the first time, verify afterwards. */
    nextStep: user.totpEnabled ? "mfa-verify" : "mfa-setup",
  });
}
