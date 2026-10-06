import { guard } from "@/lib/api/guard";
import { accessLinkStatus, revokeAccessLink } from "@/lib/auth/access-links";
import { apiFail, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/db";

/**
 * POST /api/access-links/:id/revoke
 *
 * Withdraws a link. Owner-only (`access.manage`).
 *
 * Revoking also kills the sessions and devices minted through that link, and does not
 * touch the row itself. A revoked link with a live session would leave the recipient
 * signed in after the owner withdrew the invitation, which is the whole point of
 * withdrawing it.
 */

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const gate = await guard("access.manage");
  if (!gate.ok) return gate.response;

  const existing = await prisma.accessLink.findUnique({
    where: { id },
    select: { id: true, expiresAt: true, revokedAt: true, usedAt: true },
  });

  if (!existing) return apiFail("That link does not exist.", 404);

  const changed = await revokeAccessLink(id);

  /* Cascade the withdrawal to anything that link already produced. */
  const [sessions, devices] = await Promise.all([
    prisma.session.deleteMany({ where: { accessLinkId: id } }),
    prisma.deviceSession.updateMany({
      where: { accessLinkId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorId: gate.session.user.id,
      actorEmail: gate.session.user.email,
      action: "access.revoke",
      entityType: "AccessLink",
      entityId: id,
      meta: JSON.stringify({ sessionsKilled: sessions.count, devicesRevoked: devices.count }),
    },
  });

  const current = await prisma.accessLink.findUniqueOrThrow({
    where: { id },
    select: { id: true, expiresAt: true, revokedAt: true, usedAt: true },
  });

  return apiOk({
    id,
    status: accessLinkStatus(current),
    alreadyRevoked: !changed,
    sessionsKilled: sessions.count,
    devicesRevoked: devices.count,
  });
}
