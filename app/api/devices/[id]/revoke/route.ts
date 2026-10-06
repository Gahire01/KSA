import { guard } from "@/lib/api/guard";
import { apiFail, apiOk } from "@/lib/api/response";
import {
  enforceDeviceCap,
  hashDeviceId,
  MAX_DEVICES,
  resolveDeviceId,
  revokeAllDevices,
} from "@/lib/auth/devices";
import { prisma } from "@/lib/db";

/**
 * POST /api/devices/:id/revoke
 *
 * Signs a device out, or every other device with `{ everywhere: true }`.
 *
 * Self-service and hard-scoped to the signed-in user: `where` includes `userId`, so a
 * crafted id belonging to somebody else updates zero rows and 404s rather than
 * revoking it. A device cannot revoke itself by id — that would be a confusing way to
 * sign out; `everywhere` deliberately keeps the current device.
 */

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const gate = await guard("notification.read", { requireMfa: true });
  if (!gate.ok) return gate.response;

  const userId = gate.session.user.id;

  const body: unknown = await request.json().catch(() => ({}));
  const everywhere =
    typeof body === "object" && body !== null && (body as { everywhere?: unknown }).everywhere === true;

  if (everywhere) {
    const currentDeviceId = await resolveDeviceId();
    const revoked = await revokeAllDevices(userId, currentDeviceId);

    await prisma.auditLog.create({
      data: {
        actorId: gate.session.user.id,
        actorEmail: gate.session.user.email,
        action: "device.revoke.all",
        entityType: "User",
        entityId: userId,
        meta: JSON.stringify({ revoked }),
      },
    });

    return apiOk({ revoked, everywhere: true });
  }

  const currentDeviceId = await resolveDeviceId();

  const target = await prisma.deviceSession.findFirst({
    where: { id, userId },
    select: { id: true, deviceHash: true, revokedAt: true },
  });

  if (!target) return apiFail("That device is not on your account.", 404);

  if (target.deviceHash === hashDeviceId(currentDeviceId)) {
    return apiFail("You cannot revoke the device you are using.", 422);
  }

  if (!target.revokedAt) {
    await prisma.deviceSession.update({
      where: { id: target.id },
      data: { revokedAt: new Date() },
    });
  }

  /* Revoking one frees a slot, so the cap should be re-evaluated rather than left
   * in whatever state the last sign-in left it. */
  await enforceDeviceCap(userId);

  await prisma.auditLog.create({
    data: {
      actorId: gate.session.user.id,
      actorEmail: gate.session.user.email,
      action: "device.revoke",
      entityType: "DeviceSession",
      entityId: target.id,
    },
  });

  return apiOk({ id: target.id, revoked: true, maxDevices: MAX_DEVICES });
}
