import type { NextRequest } from "next/server";

import { clearRateLimit, clientKey, LOGIN_LIMIT, rateLimit, rateLimitHit } from "@/lib/api/rate-limit";
import { apiFail, apiOk } from "@/lib/api/response";
import { loginSchema } from "@/lib/api/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { MAX_DEVICES, recordDevice } from "@/lib/auth/devices";
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
   * alone leaves a gap.
   *
   * Both are checked without spending, and spent only when the attempt actually
   * fails. Charging up front would mean successful sign-ins consume the budget
   * too: twenty staff behind one office NAT would lock the building out, and an
   * attacker who already knows a valid password could starve the real user out of
   * their own account. */
  const ipKey = clientKey(request, "login:ip");
  const perIp = rateLimit(ipKey, LOGIN_LIMIT.perIp, LOGIN_LIMIT.windowMs, { consume: false });
  if (!perIp.ok) return tooManyAttempts(perIp.retryAfterSeconds);

  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return apiFail("Enter your email and password.", 422);
  }

  const { email, password } = parsed.data;
  const accountKey = `login:account:${email.toLowerCase()}`;

  const perAccount = rateLimit(accountKey, LOGIN_LIMIT.perAccount, LOGIN_LIMIT.windowMs, {
    consume: false,
  });
  if (!perAccount.ok) return tooManyAttempts(perAccount.retryAfterSeconds);

  /* Called only on a rejected attempt, so a correct password never spends. */
  const spendAttempt = () => {
    rateLimitHit(accountKey, LOGIN_LIMIT.perAccount, LOGIN_LIMIT.windowMs);
    rateLimitHit(ipKey, LOGIN_LIMIT.perIp, LOGIN_LIMIT.windowMs);
  };

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  const invalid = apiFail("Email or password is incorrect.", 401);

  if (!user || !user.isActive) {
    /* Spend comparable time on a missing account so timing does not leak. */
    if (!user) await verifyPassword("argon2id$placeholder", password);
    spendAttempt();
    return invalid;
  }

  /* A locked account stays locked until an owner clears it — waiting does not
   * help the attacker, so there is no time-based unlock to abuse. */
  if (user.lockedAt) {
    spendAttempt();
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

    spendAttempt();
    return invalid;
  }

  /* A correct password clears the address's own failure budget: the account is
   * proven to be the legitimate user's, so stale failures must not compound into
   * a lockout they cannot escape. */
  clearRateLimit(accountKey);

  /* Phase 1 is no longer single-tenant: admins and trainers sign in with the same
   * password as the owner. What keeps this safe is that `guard()` requires
   * `mfaPassed` on every data route, and Step 4 makes TOTP enrolment mandatory
   * before a session can pass — so a password alone still reads nothing. */
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");

  await createSession({ userId: user.id, mfaPassed: false, ip, userAgent });

  /* Counted under the same five-device cap as an access-link sign-in, so the cap
   * cannot be sidestepped by using a password instead of an invite. */
  const device = await recordDevice({ userId: user.id, ip, userAgent });

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
    /** How many devices this account is signed in on, out of the cap. */
    activeDevices: device.activeCount,
    maxDevices: device.activeCount > 0 ? MAX_DEVICES : null,
  });
}
