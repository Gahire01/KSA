import { redeemReferralSchema } from "@/lib/api/access-schemas";
import {
  REFERRAL_REDEEM_LIMIT,
  clientKey,
  rateLimit,
  rateLimitFail,
} from "@/lib/api/rate-limit";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { resolveAccessPrincipal } from "@/lib/auth/access-principal";
import { ACCESS_LINK_MAX_DEVICES } from "@/lib/auth/access-links";
import { admitDevice } from "@/lib/auth/devices";
import { consumeReferralCode, normaliseReferralCode } from "@/lib/auth/referral";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/**
 * POST /api/referral-codes/redeem { code }
 *
 * The short code a team member types on the sign-in page. Same rules as a link:
 * no password, at most 5 devices per code (never more than the code's own use
 * count), a refused sixth, and a session that cannot outlast the code.
 *
 * A device that is already registered on the code is let straight back in WITHOUT
 * spending another use, so using the same browser twice does not burn the code. A
 * new device spends one use, atomically; if the code ran out in a race the device
 * is backed out again.
 *
 * Every dead code answers identically (unknown, expired, used up).
 */

const DEAD = "That code is not valid. Ask the academy for a new one.";

export async function POST(request: Request) {
  const limit = rateLimit(
    clientKey(request, "referral:redeem"),
    REFERRAL_REDEEM_LIMIT.perIp,
    REFERRAL_REDEEM_LIMIT.windowMs,
  );
  if (!limit.ok) return rateLimitFail(limit.retryAfterSeconds);

  const body: unknown = await request.json().catch(() => null);
  const parsed = redeemReferralSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");
  const code = normaliseReferralCode(parsed.data.code);

  const row = await prisma.referralCode.findUnique({
    where: { code },
    select: {
      id: true,
      role: true,
      trainerId: true,
      maxUses: true,
      timesUsed: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!row || row.revokedAt || row.expiresAt <= new Date()) return apiFail(DEAD, 410);

  const principal = await resolveAccessPrincipal({
    kind: "referral",
    id: row.id,
    role: row.role,
    trainerId: row.trainerId,
    label: null,
  });
  if (!principal.ok) return apiFail(DEAD, 410);

  const admitted = await admitDevice({
    userId: principal.userId,
    referralCodeId: row.id,
    maxDevices: Math.min(row.maxUses, ACCESS_LINK_MAX_DEVICES),
    userAgent,
    ip,
  });

  if (!admitted.ok) {
    return apiFail(
      admitted.reason === "full"
        ? `This code is already in use on ${admitted.maxDevices} device${admitted.maxDevices === 1 ? "" : "s"}. Ask the academy for a new one.`
        : "This device was removed from the code by the academy owner.",
      403,
    );
  }

  if (admitted.isNew && !(await consumeReferralCode(code))) {
    /* Used up by someone else a moment ago: back this device out. */
    await prisma.deviceSession.delete({ where: { id: admitted.deviceRowId } }).catch(() => undefined);
    return apiFail(DEAD, 410);
  }

  await createSession({
    userId: principal.userId,
    mfaPassed: true,
    referralCodeId: row.id,
    ip,
    userAgent,
    maxExpiresAt: row.expiresAt,
  });

  await prisma.auditLog
    .create({
      data: {
        actorId: principal.userId,
        action: "referral.redeem",
        entityType: "ReferralCode",
        entityId: row.id,
        meta: JSON.stringify({ role: row.role, newDevice: admitted.isNew }),
        ip,
      },
    })
    .catch((error: unknown) => console.error("[referral] audit write failed", error));

  return apiOk(
    { role: row.role, nextStep: "dashboard" as const, activeDevices: admitted.activeCount },
    201,
    { "Cache-Control": "no-store" },
  );
}
