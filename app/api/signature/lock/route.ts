import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { signatureLockSchema } from "@/lib/api/signature-schemas";
import { prisma } from "@/lib/db";

/**
 * POST /api/signature/lock { id, confirm: true }
 *
 * Makes one signature the active one and supersedes the rest, atomically. The
 * database also holds a partial unique index on isActive, so two concurrent
 * locks cannot both win. Issued certificates are unaffected: they carry their
 * own snapshot.
 */
export async function POST(request: Request) {
  const gate = await guard("signature.manage");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = signatureLockSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const target = await prisma.signature.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, isActive: true },
  });
  if (!target) return apiFail("That signature was not found.", 404);
  if (target.isActive) return apiFail("That signature is already active.", 409);

  const now = new Date();
  try {
    const locked = await prisma.$transaction(async (tx) => {
      await tx.signature.updateMany({
        where: { isActive: true },
        data: { isActive: false, supersededAt: now },
      });
      return tx.signature.update({
        where: { id: target.id },
        data: { isActive: true, lockedAt: now, supersededAt: null },
        select: {
          id: true,
          imageUrl: true,
          signerName: true,
          signerTitle: true,
          source: true,
          isActive: true,
          lockedAt: true,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        actorId: gate.session.user.id,
        actorEmail: gate.session.user.email,
        action: "signature.lock",
        entityType: "Signature",
        entityId: locked.id,
        meta: JSON.stringify({ id: locked.id, signerName: locked.signerName }),
      },
    });

    return apiOk(locked);
  } catch (error) {
    return apiFail("Could not lock the signature. Try again.", 500, { logError: error });
  }
}
