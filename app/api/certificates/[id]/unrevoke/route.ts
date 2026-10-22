import { guard } from "@/lib/api/guard";
import { apiFail, apiOk } from "@/lib/api/response";
import { certificateListSelect, certificateStatus } from "@/lib/certificates/status";
import { prisma } from "@/lib/db";
import { requestIp, requestUserAgent } from "@/lib/exams/attempt";
import { emit, ownerAndTrainerIds } from "@/lib/notifications/emit";

/**
 * POST /api/certificates/:id/unrevoke
 *
 * The rollback for a revocation made in error: clears `revokedAt` and `revokedReason`
 * so the public verification page shows the certificate as valid again. Same gate as
 * revoking (`certificate.revoke`, owner-only), and the original revocation stays in
 * the audit log, so the record shows both the withdrawal and the restore.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const gate = await guard("certificate.revoke");
  if (!gate.ok) return gate.response;

  const existing = await prisma.certificate.findUnique({
    where: { id },
    select: { id: true, revokedAt: true, revokedReason: true },
  });

  if (!existing) return apiFail("That certificate does not exist.", 404);

  /* Idempotent on the state: restoring a valid certificate returns it unchanged. */
  if (!existing.revokedAt) {
    const current = await prisma.certificate.findUniqueOrThrow({
      where: { id },
      select: certificateListSelect,
    });
    return apiOk({ ...current, status: certificateStatus(current), alreadyValid: true });
  }

  const [ip, userAgent] = await Promise.all([requestIp(), requestUserAgent()]);

  /* Matching on `revokedAt` keeps two racing restores from both auditing and notifying. */
  const cleared = await prisma.certificate.updateMany({
    where: { id, revokedAt: { not: null } },
    data: { revokedAt: null, revokedReason: null },
  });

  const restored = await prisma.certificate.findUniqueOrThrow({
    where: { id },
    select: certificateListSelect,
  });

  if (cleared.count === 1) {
    await prisma.auditLog.create({
      data: {
        actorId: gate.session.user.id,
        actorEmail: gate.session.user.email,
        action: "certificate.unrevoke",
        entityType: "Certificate",
        entityId: restored.id,
        meta: JSON.stringify({
          studentNumber: restored.studentNumber,
          courseId: restored.courseId,
          previousReason: existing.revokedReason,
        }),
        ip,
        userAgent,
      },
    });

    await emit("certificate.restored", {
      recipients: (await ownerAndTrainerIds(restored.courseId)).map((userId) => ({ userId })),
      title: "Certificate restored",
      link: `/certificates/${restored.id}`,
      body: `Certificate #${restored.studentNumber} was restored and is valid again.`,
    });
  }

  return apiOk({ ...restored, status: certificateStatus(restored), alreadyValid: false });
}
