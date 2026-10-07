import { redeemAccessLinkSchema } from "@/lib/api/access-schemas";
import {
  ACCESS_USE_LIMIT,
  clientKey,
  rateLimit,
  rateLimitFail,
} from "@/lib/api/rate-limit";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { resolveAccessPrincipal } from "@/lib/auth/access-principal";
import { consumeAccessLink, resolveAccessLink } from "@/lib/auth/access-links";
import { admitDevice } from "@/lib/auth/devices";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/**
 * POST /api/access-links/redeem { token }
 *
 * Turns a shareable link into a signed-in session. Team members have no password:
 * the link is the credential, so this is the most valuable unauthenticated endpoint
 * in the product and each rule below is load bearing.
 *
 * 1. **The token arrives in the body, not the path**, so it never lands in Referer
 *    headers, proxy logs or browser history.
 * 2. **One message for every dead link.** Unknown, revoked, used and expired all
 *    answer the same, so a stale link cannot be used to probe for live ones.
 * 3. **Devices are limited per link (default and maximum 5).** The sixth is refused
 *    with a 403, never swapped in for the oldest, and a device the owner removed
 *    stays removed.
 * 4. **The session lives and dies with the link.** It is capped at the link's expiry,
 *    and getSession ends it the moment the link is revoked or lapses.
 * 5. **A single-use link is spent atomically**, but only after the device is admitted,
 *    so a full or removed device does not burn it.
 */

const DEAD = "This link is not valid. Ask the academy for a new one.";

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

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");

  const resolved = await resolveAccessLink(parsed.data.token);

  if (!resolved.ok) {
    await prisma.auditLog
      .create({
        data: { action: "access.redeem.failed", entityType: "AccessLink", meta: JSON.stringify({ reason: resolved.status }), ip },
      })
      .catch((error: unknown) => console.error("[access] audit write failed", error));
    return apiFail(DEAD, 410);
  }

  const { link } = resolved;

  const principal = await resolveAccessPrincipal({
    kind: "link",
    id: link.id,
    role: link.role,
    trainerId: link.trainerId,
    label: link.label,
  });
  if (!principal.ok) return apiFail(DEAD, 410);

  const admitted = await admitDevice({
    userId: principal.userId,
    accessLinkId: link.id,
    maxDevices: link.maxDevices,
    userAgent,
    ip,
  });

  if (!admitted.ok) {
    await prisma.auditLog
      .create({
        data: {
          action: "access.redeem.blocked",
          entityType: "AccessLink",
          entityId: link.id,
          meta: JSON.stringify({ reason: admitted.reason, maxDevices: link.maxDevices }),
          ip,
        },
      })
      .catch((error: unknown) => console.error("[access] audit write failed", error));

    return apiFail(
      admitted.reason === "full"
        ? `This link is already in use on ${admitted.maxDevices} devices. Ask the academy owner to remove one or send you a new link.`
        : "This device was removed from the link by the academy owner.",
      403,
    );
  }

  /* Compare-and-set: two devices redeeming a single-use link at once cannot both win. */
  if (link.singleUse && !(await consumeAccessLink(link.id))) {
    /* Lost the race: back this device out so it does not hold a slot on a spent link. */
    if (admitted.isNew) {
      await prisma.deviceSession.delete({ where: { id: admitted.deviceRowId } }).catch(() => undefined);
    }
    return apiFail(DEAD, 410);
  }

  await createSession({
    userId: principal.userId,
    mfaPassed: true,
    accessLinkId: link.id,
    ip,
    userAgent,
    maxExpiresAt: link.expiresAt,
  });

  await prisma.auditLog
    .create({
      data: {
        actorId: principal.userId,
        action: "access.redeem",
        entityType: "AccessLink",
        entityId: link.id,
        meta: JSON.stringify({ role: link.role, activeDevices: admitted.activeCount }),
        ip,
      },
    })
    .catch((error: unknown) => console.error("[access] audit write failed", error));

  return apiOk(
    {
      role: link.role,
      nextStep: "dashboard" as const,
      activeDevices: admitted.activeCount,
      maxDevices: admitted.maxDevices,
    },
    201,
    { "Cache-Control": "no-store" },
  );
}
