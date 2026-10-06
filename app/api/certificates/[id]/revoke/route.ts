import { guard } from "@/lib/api/guard";
import { revokeCertificateSchema } from "@/lib/api/certificate-schemas";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { certificateListSelect, certificateStatus } from "@/lib/certificates/status";
import { prisma } from "@/lib/db";
import { requestIp, requestUserAgent } from "@/lib/exams/attempt";

/**
 * POST /api/certificates/:id/revoke
 *
 * Withdraws a certificate. The row is kept, never deleted: a revoked certificate
 * that quietly vanished would leave an employer holding a PDF with no way to learn
 * it was withdrawn, and it would destroy the audit trail.
 *
 * Owner-only (see the `certificate.revoke` grant). Revocation is not undoable from
 * the UI — it is a statement to employers, so re-issuing means a fresh exam.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const gate = await guard("certificate.revoke");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = revokeCertificateSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const [ip, userAgent] = await Promise.all([requestIp(), requestUserAgent()]);

  const existing = await prisma.certificate.findUnique({
    where: { id },
    select: { id: true, revokedAt: true },
  });

  if (!existing) return apiFail("That certificate does not exist.", 404);

  /* Idempotent on the state, strict on the input: revoking twice returns the same
   * certificate rather than an error, so a double-clicked button is not a failure. */
  if (existing.revokedAt) {
    const current = await prisma.certificate.findUniqueOrThrow({
      where: { id },
      select: certificateListSelect,
    });
    return apiOk({ ...current, status: certificateStatus(current), alreadyRevoked: true });
  }

  const revoked = await prisma.certificate.update({
    where: { id },
    data: { revokedAt: new Date(), revokedReason: parsed.data.reason },
    select: certificateListSelect,
  });

  await prisma.auditLog.create({
    data: {
      actorId: gate.session.user.id,
      actorEmail: gate.session.user.email,
      action: "certificate.revoke",
      entityType: "Certificate",
      entityId: revoked.id,
      meta: JSON.stringify({
        studentNumber: revoked.studentNumber,
        courseId: revoked.courseId,
        reason: parsed.data.reason,
      }),
      ip,
      userAgent,
    },
  });

  return apiOk({ ...revoked, status: certificateStatus(revoked), alreadyRevoked: false });
}
