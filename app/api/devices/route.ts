import { guard } from "@/lib/api/guard";
import { apiOk } from "@/lib/api/response";
import { activeDeviceCount, hashDeviceId, MAX_DEVICES, resolveDeviceId } from "@/lib/auth/devices";
import { prisma } from "@/lib/db";

/**
 * GET /api/devices — the signed-in user's own devices.
 *
 * Note this is *self-service*, not the OWNER-only `device.manage` grant. The grant
 * covers managing other people's devices; a user being unable to see or sign out of
 * their own sessions would be the wrong kind of secure. The route is hard-scoped to
 * `session.user.id`, so there is no id parameter to tamper with.
 *
 * `deviceHash` is never returned: it is a keyed HMAC of the device cookie, so
 * exposing it would hand out a replayable fingerprint. Devices are identified by a
 * short non-reversible label derived for display only.
 */

export async function GET() {
  const gate = await guard("device.self");
  if (!gate.ok) return gate.response;

  const userId = gate.session.user.id;
  const currentDeviceId = await resolveDeviceId();
  const currentDeviceHash = hashDeviceId(currentDeviceId);

  const devices = await prisma.deviceSession.findMany({
    where: { userId },
    select: {
      id: true,
      deviceHash: true,
      userAgent: true,
      ipAddress: true,
      lastSeenAt: true,
      createdAt: true,
      revokedAt: true,
      accessLink: { select: { label: true, referralCode: true } },
    },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
  });

  return apiOk({
    items: devices.map((d, index) => ({
      id: d.id,
      /* Positional rather than a hash: stable enough to tell two devices apart in a
       * list, and reveals nothing. */
      label: `Device ${index + 1}`,
      userAgent: d.userAgent,
      ipAddress: d.ipAddress,
      lastSeenAt: d.lastSeenAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
      revokedAt: d.revokedAt ? d.revokedAt.toISOString() : null,
      status: d.revokedAt ? "REVOKED" : "ACTIVE",
      current: d.deviceHash === currentDeviceHash,
      viaLink: d.accessLink?.label ?? d.accessLink?.referralCode ?? null,
    })),
    maxDevices: MAX_DEVICES,
    activeCount: await activeDeviceCount(userId),
  });
}
