import { guard } from "@/lib/api/guard";
import { apiNotFound, apiOk } from "@/lib/api/response";
import { actorOf, audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

/**
 * POST /api/referral-codes/:id/revoke
 *
 * Withdraws a code. Owner only (`access.manage`). Like revoking a link, it also ends
 * every session the code produced and removes its devices, so a leaked code cannot
 * leave anyone signed in after the owner pulled it.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await guard("access.manage");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const code = await prisma.referralCode.findUnique({ where: { id }, select: { id: true } });
  if (!code) return apiNotFound("Referral code");

  const now = new Date();
  const [revoked, sessions, devices] = await Promise.all([
    prisma.referralCode.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } }),
    prisma.session.deleteMany({ where: { referralCodeId: id } }),
    prisma.deviceSession.updateMany({
      where: { referralCodeId: id, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  await audit({
    ...actorOf(gate.session),
    action: "referral.revoke",
    entityType: "ReferralCode",
    entityId: id,
    meta: { sessionsKilled: sessions.count, devicesRevoked: devices.count },
  });

  return apiOk({
    id,
    alreadyRevoked: revoked.count === 0,
    sessionsKilled: sessions.count,
    devicesRevoked: devices.count,
  });
}
