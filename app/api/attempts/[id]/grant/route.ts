import { guard } from "@/lib/api/guard";
import { apiFail, apiNotFound, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { requestIp } from "@/lib/exams/attempt";
import { issueAttempt } from "@/lib/exams/issue-attempt";

/**
 * POST /api/attempts/:id/grant
 *
 * The owner grants one more attempt after a trainee has used all of theirs. The
 * :id is the trainee's last (failed) attempt. Owner only, audit-logged, and it
 * puts the enrolment back from FAILED to ACTIVE so the trainee can sit again.
 *
 * Only a failed, exhausted sitting can be extended: it cannot be used to give a
 * trainee a second go after a pass, or a third go while one is still pending.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await guard("exam.grant");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const last = await prisma.examAttempt.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      traineeId: true,
      courseId: true,
      attemptNumber: true,
      course: { select: { maxAttempts: true, name: true } },
    },
  });
  if (!last) return apiNotFound("Attempt");

  if (last.status !== "FAILED") {
    return apiFail("Only an attempt that failed with no attempts left can be extended.", 409);
  }

  const newer = await prisma.examAttempt.findFirst({
    where: { traineeId: last.traineeId, courseId: last.courseId, attemptNumber: { gt: last.attemptNumber } },
    select: { id: true },
  });
  if (newer) return apiFail("A later attempt already exists for this trainee.", 409);

  const issued = await issueAttempt({
    traineeId: last.traineeId,
    courseId: last.courseId,
    attemptNumber: last.attemptNumber + 1,
  });
  if (!issued.ok) {
    if (issued.exists) return apiFail("Another attempt for this trainee was just created.", 409);
    return apiFail("The new attempt could not be emailed, so nothing was changed. Try again.", 502);
  }

  await prisma.trainee.update({ where: { id: last.traineeId }, data: { status: "ACTIVE" } });

  await prisma.auditLog
    .create({
      data: {
        actorId: gate.session.user.id,
        actorEmail: gate.session.user.email,
        action: "exam.attempt.grant",
        entityType: "ExamAttempt",
        entityId: issued.attemptId,
        meta: JSON.stringify({
          traineeId: last.traineeId,
          courseId: last.courseId,
          attemptNumber: issued.attemptNumber,
          afterAttempt: last.id,
        }),
        ip: await requestIp(),
      },
    })
    .catch((error: unknown) => console.error("[attempt-grant] audit write failed", error));

  return apiOk({ attemptId: issued.attemptId, attemptNumber: issued.attemptNumber, emailed: true }, 201);
}
