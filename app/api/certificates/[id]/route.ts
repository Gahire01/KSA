import { guard } from "@/lib/api/guard";
import { apiFail, apiOk } from "@/lib/api/response";
import { certificateStatus } from "@/lib/certificates/status";
import { prisma } from "@/lib/db";

/**
 * GET /api/certificates/:id — the staff detail view.
 *
 * Carries more than the public projection, including `contentHash` and the attempt
 * it came from, because staff legitimately need to trace a certificate back to the
 * exam that produced it. `certificate.read` is the gate; the public route is the one
 * that has to be thin.
 */

const detailSelect = {
  id: true,
  traineeId: true,
  courseId: true,
  attemptId: true,
  studentNumber: true,
  verificationToken: true,
  contentHash: true,
  topicsSnapshot: true,
  durationSnapshot: true,
  trainerNameSnapshot: true,
  trainerTitleSnapshot: true,
  issuedAt: true,
  expiresAt: true,
  revokedAt: true,
  revokedReason: true,
  createdAt: true,
  trainee: {
    select: { id: true, fullName: true, traineeNo: true, categoryName: true, email: true },
  },
  course: { select: { id: true, code: true, name: true, topics: true } },
} as const;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const gate = await guard("certificate.read");
  if (!gate.ok) return gate.response;

  const cert = await prisma.certificate.findUnique({ where: { id }, select: detailSelect });

  if (!cert) return apiFail("That certificate does not exist.", 404);

  return apiOk({ ...cert, status: certificateStatus(cert) });
}
