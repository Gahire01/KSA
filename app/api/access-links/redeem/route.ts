import { redeemAccessLinkSchema } from "@/lib/api/access-schemas";
import {
  ACCESS_USE_LIMIT,
  clientKey,
  rateLimit,
  rateLimitFail,
} from "@/lib/api/rate-limit";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { consumeAccessLink, resolveAccessLink } from "@/lib/auth/access-links";
import { recordDevice } from "@/lib/auth/devices";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/**
 * POST /api/access-links/redeem
 *
 * Turns a shareable link into an account and a session.
 *
 * This is the most valuable unauthenticated endpoint in the product: a valid token
 * creates a real, usable account. Four things follow from that, and each is load
 * bearing:
 *
 * 1. **The token arrives in the body, not the path.** A token in a URL lands in
 *    `Referer` headers, proxy access logs and browser history. This way it does not.
 * 2. **The session is complete on creation.** Sign-in is email OTP from /login and
 *    nothing branches on `Session.mfaPassed` anymore, so an invited account lands on
 *    the dashboard the moment it is minted. The column is kept for a possible TOTP
 *    return, and `User.totpSecret` stays empty until then.
 * 3. **The single-use link is spent before the account exists.** `consumeAccessLink`
 *    is a compare-and-set, so two simultaneous redemptions cannot both get in. The
 *    trade-off is that a failure *after* the spend burns the link; that is the right
 *    way round, because the alternative is two accounts from one invitation.
 * 4. **The device is recorded under the 5-device cap** like any other sign-in, so an
 *    invite link is not a way around it.
 */

export async function POST(request: Request) {
  const limit = rateLimit(
    clientKey(request, "access:redeem"),
    ACCESS_USE_LIMIT.perIp,
    ACCESS_USE_LIMIT.windowMs,
  );
  if (!limit.ok) return rateLimitFail(limit.retryAfterSeconds);

  const body: unknown = await request.json().catch(() => null);
  const parsed = redeemAccessLinkSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const { token, email, password, fullName } = parsed.data;
  const normalisedEmail = email.toLowerCase();

  /* One message for unknown, revoked, used and expired. Telling a recipient which of
   * the four it was would let anyone holding a stale link probe for valid ones. */
  const resolved = await resolveAccessLink(token);

  if (!resolved.ok) {
    await prisma.auditLog.create({
      data: {
        actorEmail: normalisedEmail,
        action: "access.redeem.failed",
        entityType: "AccessLink",
        meta: JSON.stringify({ reason: resolved.status }),
      },
    });
    return apiFail("This invitation link is not valid.", 410);
  }

  /* An account that already exists keeps using password login. Redeeming over it
   * would let anyone holding a link silently reset somebody's access. */
  const existing = await prisma.user.findUnique({
    where: { email: normalisedEmail },
    select: { id: true },
  });

  if (existing) {
    return apiFail(
      "An account already exists for that email. Sign in with your password.",
      409,
    );
  }

  /* Spend the link first. Compare-and-set, so a concurrent second redemption loses. */
  if (resolved.link.singleUse && !(await consumeAccessLink(resolved.link.id))) {
    return apiFail("This invitation link has already been used.", 410);
  }

  const user = await prisma.user.create({
    data: {
      email: normalisedEmail,
      name: fullName,
      passwordHash: await hashPassword(password),
      role: resolved.link.role,
      /* No TOTP secret: this account signs in with its password and, from /login,
       * an emailed code. Enrolment is not part of the flow. */
      totpEnabled: false,
      lastLoginAt: new Date(),
    },
    select: { id: true, email: true, role: true, totpEnabled: true },
  });

  await createSession({
    userId: user.id,
    mfaPassed: true,
    accessLinkId: resolved.link.id,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  });

  const device = await recordDevice({
    userId: user.id,
    accessLinkId: resolved.link.id,
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action: "access.redeem",
      entityType: "AccessLink",
      entityId: resolved.link.id,
      meta: JSON.stringify({
        role: user.role,
        trainerId: resolved.link.trainerId,
        activeDevices: device.activeCount,
      }),
    },
  });

  return apiOk(
    {
      email: user.email,
      role: user.role,
      totpEnabled: user.totpEnabled,
      /* There is no second factor in the sign-in path anymore, so the invited
       * account goes straight through. */
      nextStep: "dashboard" as const,
      activeDevices: device.activeCount,
    },
    201,
    { "Cache-Control": "no-store" },
  );
}
