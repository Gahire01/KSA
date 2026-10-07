import { guard } from "@/lib/api/guard";
import { apiNotFound, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/db";

/**
 * GET /api/access-links/:id/devices — the devices signed in through one link.
 *
 * Owner only (`device.manage`). `deviceHash` is never returned: it is a keyed
 * digest of the device cookie and exposing it would hand out a replayable
 * fingerprint. Devices are identified by IP, user agent and last-seen time.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await guard("device.manage");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const link = await prisma.accessLink.findUnique({
    where: { id },
    select: { id: true, label: true, maxDevices: true },
  });
  if (!link) return apiNotFound("Link");

  const devices = await prisma.deviceSession.findMany({
    where: { accessLinkId: id },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      lastSeenAt: true,
      createdAt: true,
      revokedAt: true,
    },
  });

  return apiOk({
    link,
    items: devices.map((d) => ({ ...d, status: d.revokedAt ? "REMOVED" : "ACTIVE" })),
    activeCount: devices.filter((d) => !d.revokedAt).length,
  });
}
