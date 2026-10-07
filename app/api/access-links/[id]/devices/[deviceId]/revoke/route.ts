import { guard } from "@/lib/api/guard";
import { apiNotFound, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/db";

/**
 * POST /api/access-links/:id/devices/:deviceId/revoke
 *
 * The owner removes one device from a link. That frees its slot, and because the
 * device is marked revoked, the session it holds ends on its next request (see
 * deviceState in lib/auth/devices.ts) and it cannot re-enter through the same link.
 *
 * The device must belong to the link in the path: a mismatched pair updates zero
 * rows and 404s instead of revoking something on another link.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; deviceId: string }> },
) {
  const gate = await guard("device.manage");
  if (!gate.ok) return gate.response;

  const { id, deviceId } = await context.params;

  const device = await prisma.deviceSession.findFirst({
    where: { id: deviceId, accessLinkId: id },
    select: { id: true, revokedAt: true },
  });
  if (!device) return apiNotFound("Device");

  if (!device.revokedAt) {
    await prisma.deviceSession.update({ where: { id: device.id }, data: { revokedAt: new Date() } });
  }

  await prisma.auditLog
    .create({
      data: {
        actorId: gate.session.user.id,
        actorEmail: gate.session.user.email,
        action: "access.device.revoke",
        entityType: "DeviceSession",
        entityId: device.id,
        meta: JSON.stringify({ accessLinkId: id }),
      },
    })
    .catch((error: unknown) => console.error("[access] audit write failed", error));

  return apiOk({ id: device.id, revoked: true });
}
