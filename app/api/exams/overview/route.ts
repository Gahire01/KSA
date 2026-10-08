import { guard } from "@/lib/api/guard";
import { apiOk } from "@/lib/api/response";
import { courseWhere } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";

/**
 * GET /api/exams/overview — one row per active course: its exam rules, how many
 * questions are in its bank, and how its attempts have gone.
 *
 * An "exam" is a course: the paper is drawn from the course's question bank and
 * frozen per trainee on their attempt, so there is no separate Exam record. This
 * is what the Exams page lists. A trainer sees only their own courses.
 */
export async function GET() {
  const gate = await guard("exam.read", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const courses = await prisma.course.findMany({
    where: { isActive: true, ...courseWhere(gate.trainerScope) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      passMarkPct: true,
      maxAttempts: true,
      examDurationMin: true,
      _count: { select: { questions: { where: { isActive: true } } } },
    },
  });

  const ids = courses.map((c) => c.id);
  const grouped = ids.length
    ? await prisma.examAttempt.groupBy({
        by: ["courseId", "status"],
        where: { courseId: { in: ids } },
        _count: { _all: true },
      })
    : [];

  const stats = new Map<string, Record<string, number>>();
  for (const row of grouped) {
    const bucket = stats.get(row.courseId) ?? {};
    bucket[row.status] = row._count._all;
    stats.set(row.courseId, bucket);
  }

  return apiOk({
    items: courses.map((course) => {
      const by = stats.get(course.id) ?? {};
      const count = (s: string) => by[s] ?? 0;
      return {
        id: course.id,
        code: course.code,
        name: course.name,
        passMarkPct: course.passMarkPct,
        maxAttempts: course.maxAttempts,
        examDurationMin: course.examDurationMin,
        questionCount: course._count.questions,
        attempts: {
          total: Object.values(by).reduce((a, b) => a + b, 0),
          waiting: count("PENDING"),
          inProgress: count("STARTED"),
          passed: count("PASSED"),
          failed: count("FAILED") + count("SUBMITTED"),
        },
      };
    }),
  });
}
