import { guard } from "@/lib/api/guard";
import { apiFail, apiOk } from "@/lib/api/response";
import { viaCourse } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";

const EXAM_STATUSES = ["PENDING", "STARTED", "SUBMITTED", "PASSED", "FAILED", "VOID"];

/**
 * GET /api/exams — attempt history across courses.
 *
 * Attempts are the exam record: there is no separate Exam model, because a
 * "paper" only exists as the frozen manifest on one trainee's attempt.
 *
 * `isCorrect` is not selected anywhere here, so nothing that marks an option can
 * reach the staff view either.
 */

export async function GET(request: Request) {
  const gate = await guard("exam.read", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim() || undefined;
  const status = url.searchParams.get("status")?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "25", 10) || 25),
  );

  /* A status that is not a real one is a 422, not an unchecked cast that reaches the
   * database and comes back as a 500. */
  if (status && !EXAM_STATUSES.includes(status)) return apiFail("Unknown status.", 422);

  const where = {
    ...viaCourse(gate.trainerScope),
    ...(courseId ? { courseId } : {}),
    ...(status ? { status: status as "PENDING" } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.examAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        attemptNumber: true,
        scorePct: true,
        correctCount: true,
        totalCount: true,
        blurCount: true,
        startedAt: true,
        submittedAt: true,
        linkExpiresAt: true,
        otpExpiresAt: true,
        createdAt: true,
        ip: true,
        userAgent: true,
        trainee: { select: { id: true, fullName: true, email: true, traineeNo: true } },
        course: { select: { id: true, name: true, code: true, trainerId: true } },
        certificate: { select: { id: true, studentNumber: true } },
      },
    }),
    prisma.examAttempt.count({ where }),
  ]);

  return apiOk({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}