import { guard } from "@/lib/api/guard";
import { referralCodeCreateSchema } from "@/lib/api/access-schemas";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { mintReferralCode } from "@/lib/auth/referral";
import { prisma } from "@/lib/db";

/**
 * /api/referral-codes — owner-managed attribution codes.
 *
 * Unlike access links, a referral code is stored in the clear and returned freely:
 * it is an attribution label, not a credential. It cannot sign anyone in.
 */

export async function GET(request: Request) {
  const gate = await guard("access.manage");
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const includeSpent = url.searchParams.get("all") === "1";

  const codes = await prisma.referralCode.findMany({
    where: includeSpent ? {} : { expiresAt: { gt: new Date() } },
    select: {
      id: true,
      code: true,
      role: true,
      trainerId: true,
      maxUses: true,
      timesUsed: true,
      expiresAt: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
      _count: { select: { devices: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const now = new Date();

  return apiOk({
    items: codes.map((c) => ({
      ...c,
      remaining: Math.max(0, c.maxUses - c.timesUsed),
      status: c.expiresAt <= now ? "EXPIRED" : c.timesUsed >= c.maxUses ? "USED" : "ACTIVE",
    })),
    total: codes.length,
  });
}

export async function POST(request: Request) {
  const gate = await guard("access.manage");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = referralCodeCreateSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const { role, trainerId, maxUses, expiresInDays } = parsed.data;

  if (role === "TRAINER" && trainerId) {
    const trainer = await prisma.user.findUnique({
      where: { id: trainerId },
      select: { role: true, isActive: true },
    });
    if (!trainer || trainer.role !== "TRAINER" || !trainer.isActive) {
      return apiFail("That trainer does not exist or is not active.", 422);
    }
  }

  const code = await mintReferralCode({
    createdById: gate.session.user.id,
    role,
    trainerId: trainerId ?? null,
    maxUses,
    expiresInDays,
  });

  await prisma.auditLog.create({
    data: {
      actorId: gate.session.user.id,
      actorEmail: gate.session.user.email,
      action: "referral.mint",
      entityType: "ReferralCode",
      entityId: code.id,
      meta: JSON.stringify({ role, maxUses, trainerId: trainerId ?? null }),
    },
  });

  return apiOk(
    {
      id: code.id,
      code: code.code,
      maxUses: code.maxUses,
      expiresAt: code.expiresAt.toISOString(),
    },
    201,
    { "Cache-Control": "no-store" },
  );
}
