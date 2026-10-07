import { guard } from "@/lib/api/guard";
import { accessLinkCreateSchema } from "@/lib/api/access-schemas";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { accessLinkStatus, mintAccessLink } from "@/lib/auth/access-links";
import { prisma } from "@/lib/db";

/**
 * /api/access-links — the owner's list of sign-in links, and minting new ones.
 *
 * `access.manage` is OWNER-only in `lib/auth/authorize.ts`. Minting a way in is the
 * most privileged action in the product, so there is deliberately no admin or trainer
 * path to it.
 *
 * Listing never returns a token: only the stored digest exists, and it is not
 * reversible. The plaintext appears exactly once, in the POST response.
 */

const listSelect = {
  id: true,
  referralCode: true,
  role: true,
  trainerId: true,
  label: true,
  expiresAt: true,
  singleUse: true,
  usedAt: true,
  revokedAt: true,
  createdAt: true,
  createdBy: { select: { name: true, email: true } },
  maxDevices: true,
  /* Only devices still admitted: a removed device frees its slot. */
  _count: { select: { devices: { where: { revokedAt: null } }, sessions: true } },
} as const;

export async function GET(request: Request) {
  const gate = await guard("access.manage");
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const includeSpent = url.searchParams.get("all") === "1";

  const links = await prisma.accessLink.findMany({
    where: includeSpent ? {} : { revokedAt: null, usedAt: null, expiresAt: { gt: new Date() } },
    select: listSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const now = new Date();

  return apiOk({
    items: links.map((l) => ({ ...l, status: accessLinkStatus(l, now) })),
    total: links.length,
  });
}

export async function POST(request: Request) {
  const gate = await guard("access.manage");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = accessLinkCreateSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const { role, trainerId, label, expiresInHours, singleUse, maxDevices } = parsed.data;

  /* A trainer link must point at a real, active trainer, or it would mint a link that
   * grants TRAINER access but can never be scoped to a course. */
  if (role === "TRAINER" && trainerId) {
    const trainer = await prisma.user.findUnique({
      where: { id: trainerId },
      select: { role: true, isActive: true },
    });
    if (!trainer || trainer.role !== "TRAINER" || !trainer.isActive) {
      return apiFail("That trainer does not exist or is not active.", 422);
    }
  }

  const minted = await mintAccessLink({
    createdById: gate.session.user.id,
    role,
    trainerId: trainerId ?? null,
    label: label ?? null,
    ...(expiresInHours !== undefined ? { expiresInHours } : {}),
    ...(maxDevices !== undefined ? { maxDevices } : {}),
    singleUse,
  });

  await prisma.auditLog
    .create({
      data: {
        actorId: gate.session.user.id,
        actorEmail: gate.session.user.email,
        action: "access.mint",
        entityType: "AccessLink",
        entityId: minted.id,
        /* The link and token are deliberately absent: they are secrets, and the audit
         * log is read by people who should not necessarily hold working invites. */
        meta: JSON.stringify({
          role,
          singleUse,
          maxDevices: minted.maxDevices,
          expiresAt: minted.expiresAt.toISOString(),
        }),
      },
    })
    .catch((error: unknown) => console.error("[access] audit write failed", error));

  /* `Cache-Control: no-store` is essential here: a cached POST response is a cached
   * working credential. */
  return apiOk(
    {
      id: minted.id,
      url: minted.url,
      token: minted.token,
      referralCode: minted.referralCode,
      expiresAt: minted.expiresAt.toISOString(),
      singleUse: minted.singleUse,
      maxDevices: minted.maxDevices,
    },
    201,
    { "Cache-Control": "no-store" },
  );
}
