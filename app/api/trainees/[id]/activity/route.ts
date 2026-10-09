import { guard } from "@/lib/api/guard";
import { apiNotFound, apiOk } from "@/lib/api/response";
import { viaCourse } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";

/**
 * GET /api/trainees/:id/activity — what the trainee has actually done: exam
 * attempts, certificates and payments, newest first.
 *
 * A trainer only reaches trainees on their own courses (the same filter as the
 * trainee itself), and never sees money: `payments` is null for them.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await guard("trainee.read", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const trainee = await prisma.trainee.findFirst({
    where: { id, ...viaCourse(gate.trainerScope) },
    select: { id: true },
  });
  if (!trainee) return apiNotFound("Trainee");

  const [attempts, certificates, payments] = await Promise.all([
    prisma.examAttempt.findMany({
      where: { traineeId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        courseId: true,
        status: true,
        attemptNumber: true,
        scorePct: true,
        startedAt: true,
        submittedAt: true,
        createdAt: true,
        course: { select: { name: true } },
      },
    }),
    prisma.certificate.findMany({
      where: { traineeId: id },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        courseId: true,
        studentNumber: true,
        issuedAt: true,
        revokedAt: true,
        course: { select: { name: true } },
      },
    }),
    gate.trainerScope
      ? Promise.resolve(null)
      : prisma.payment.findMany({
          where: { traineeId: id },
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          take: 100,
          select: {
            id: true,
            receiptNo: true,
            amountRwf: true,
            method: true,
            paidAt: true,
            refundOfId: true,
          },
        }),
  ]);

  return apiOk({
    attempts: attempts.map((a) => ({
      ...a,
      startedAt: a.startedAt?.toISOString() ?? null,
      submittedAt: a.submittedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      courseName: a.course.name,
    })),
    certificates: certificates.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      courseName: c.course.name,
      studentNumber: c.studentNumber,
      issuedAt: c.issuedAt.toISOString(),
      status: c.revokedAt ? "REVOKED" : "VALID",
    })),
    payments: payments
      ? payments.map((p) => ({ ...p, paidAt: p.paidAt.toISOString(), isRefund: p.refundOfId !== null }))
      : null,
  });
}
