import { guard } from "@/lib/api/guard";
import { apiOk } from "@/lib/api/response";
import { courseWhere, viaCourse } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";

/**
 * GET /api/dashboard — everything the home page shows, from the database.
 *
 * Nothing here is invented: an empty academy returns zeros and empty lists, and the
 * page renders those as empty states. A trainer only sees their own courses' figures,
 * and never the money (`revenue` is null for them).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function pctChange(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

/** "trainee.create" -> "Created a trainee": a readable line for the activity feed. */
const ACTION_TEXT: Record<string, string> = {
  "trainee.create": "enrolled a trainee",
  "trainee.update": "updated a trainee",
  "trainee.delete": "deleted a trainee",
  "course.create": "created a course",
  "course.update": "updated a course",
  "exam.submit": "submitted an exam",
  "exam.send": "sent an exam",
  "exam.attempt.grant": "granted another attempt",
  "certificate.revoke": "revoked a certificate",
  "payment.record": "recorded a payment",
  "payment.refund": "recorded a refund",
  "question.create": "added a question",
  "exam.questions.imported": "imported questions",
};

export async function GET() {
  const gate = await guard("trainee.read", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const scope = gate.trainerScope;
  const isTrainer = scope !== null;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const in30Days = new Date(now.getTime() + 30 * DAY_MS);

  const traineeScope = viaCourse(scope);
  const courseScope = courseWhere(scope);

  const [
    totalTrainees,
    newThisMonth,
    activeCourses,
    certsThisMonth,
    certsLastMonth,
    certsThisQuarter,
    sittingsOpen,
    byCategory,
    deadlineRows,
    emptyBanks,
    recentExhausted,
    flagged,
    graded,
    audit,
  ] = await Promise.all([
    prisma.trainee.count({ where: traineeScope }),
    prisma.trainee.count({ where: { ...traineeScope, enrolledAt: { gte: monthStart } } }),
    prisma.course.count({ where: { isActive: true, ...courseScope } }),
    prisma.certificate.count({ where: { ...traineeScope, issuedAt: { gte: monthStart } } }),
    prisma.certificate.count({ where: { ...traineeScope, issuedAt: { gte: lastMonthStart, lt: monthStart } } }),
    prisma.certificate.count({ where: { ...traineeScope, issuedAt: { gte: quarterStart } } }),
    prisma.examAttempt.count({ where: { ...traineeScope, status: { in: ["PENDING", "STARTED"] } } }),
    prisma.trainee.groupBy({ by: ["categoryId"], where: traineeScope, _count: { _all: true } }),
    prisma.trainee.findMany({
      where: { ...traineeScope, status: { in: ["PENDING", "ACTIVE"] }, deadlineAt: { not: null, lte: in30Days } },
      orderBy: { deadlineAt: "asc" },
      take: 8,
      select: { id: true, fullName: true, deadlineAt: true, course: { select: { name: true } } },
    }),
    prisma.course.findMany({
      where: { isActive: true, ...courseScope, questions: { none: { isActive: true } } },
      select: { id: true, name: true },
      take: 5,
    }),
    prisma.trainee.findMany({
      where: { ...traineeScope, status: "FAILED", updatedAt: { gte: new Date(now.getTime() - 14 * DAY_MS) } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, fullName: true, updatedAt: true, course: { select: { name: true } } },
    }),
    prisma.examAttempt.findMany({
      where: { ...traineeScope, blurCount: { gt: 0 }, createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        courseId: true,
        blurCount: true,
        createdAt: true,
        trainee: { select: { fullName: true } },
      },
    }),
    prisma.examAttempt.groupBy({
      by: ["courseId", "status"],
      where: { ...traineeScope, status: { in: ["PASSED", "FAILED", "SUBMITTED"] } },
      _count: { _all: true },
      _avg: { scorePct: true },
    }),
    /* Staff-wide trail; a trainer's feed is limited to nothing rather than other people's work. */
    isTrainer
      ? Promise.resolve([])
      : prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, actorEmail: true, action: true, entityType: true, createdAt: true },
        }),
  ]);

  /* Categories */
  const categoryNames = new Map(
    (await prisma.category.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]),
  );
  const categories = byCategory
    .map((row) => ({ category: categoryNames.get(row.categoryId) ?? "Other", count: row._count._all }))
    .sort((a, b) => b.count - a.count);

  /* Pass rate by course */
  const courses = await prisma.course.findMany({
    where: { isActive: true, ...courseScope },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const passRates = courses.map((course) => {
    const rows = graded.filter((g) => g.courseId === course.id);
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    const passed = rows.filter((r) => r.status === "PASSED").reduce((sum, r) => sum + r._count._all, 0);
    const weighted = rows.reduce((sum, r) => sum + (r._avg.scorePct ?? 0) * r._count._all, 0);
    return {
      courseId: course.id,
      courseName: course.name,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      attempts: total,
      averageScore: total > 0 ? Math.round(weighted / total) : 0,
    };
  });

  /* Money: owner and admin only. Collected is net of refunds; invoiced is the standard price
   * of everyone enrolled that month. */
  let revenue: Array<{ month: string; collectedRwf: number; invoiceRwf: number }> | null = null;
  if (!isTrainer) {
    const [paid, invoiced] = await Promise.all([
      prisma.$queryRaw<Array<{ m: string; total: bigint }>>`
        SELECT to_char(date_trunc('month', "paidAt"), 'YYYY-MM') AS m, COALESCE(SUM("amountRwf"), 0)::bigint AS total
        FROM "Payment" WHERE "paidAt" >= ${sixMonthsAgo} GROUP BY 1`,
      prisma.$queryRaw<Array<{ m: string; total: bigint }>>`
        SELECT to_char(date_trunc('month', t."enrolledAt"), 'YYYY-MM') AS m, COALESCE(SUM(c."priceRwf"), 0)::bigint AS total
        FROM "Trainee" t JOIN "Course" c ON c.id = t."courseId"
        WHERE t."enrolledAt" >= ${sixMonthsAgo} GROUP BY 1`,
    ]);
    const paidBy = new Map(paid.map((r) => [r.m, Number(r.total)]));
    const invBy = new Map(invoiced.map((r) => [r.m, Number(r.total)]));
    revenue = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      revenue.push({
        month: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
        collectedRwf: paidBy.get(key) ?? 0,
        invoiceRwf: invBy.get(key) ?? 0,
      });
    }
  }

  /* Alerts */
  const alerts: Array<{ id: string; severity: "info" | "warning" | "critical"; text: string; at: string; link: string }> = [];
  for (const row of deadlineRows) {
    const days = Math.ceil(((row.deadlineAt as Date).getTime() - now.getTime()) / DAY_MS);
    if (days <= 7) {
      alerts.push({
        id: `deadline-${row.id}`,
        severity: days < 0 ? "critical" : "warning",
        text:
          days < 0
            ? `${row.fullName}'s deadline${row.course ? ` for ${row.course.name}` : ""} has passed.`
            : `${row.fullName}'s deadline${row.course ? ` for ${row.course.name}` : ""} is in ${days} day${days === 1 ? "" : "s"}.`,
        at: (row.deadlineAt as Date).toISOString(),
        link: `/trainees/${row.id}`,
      });
    }
  }
  for (const row of recentExhausted) {
    alerts.push({
      id: `failed-${row.id}`,
      severity: "critical",
      text: `${row.fullName} has used every attempt${row.course ? ` on ${row.course.name}` : ""}.`,
      at: row.updatedAt.toISOString(),
      link: `/trainees/${row.id}`,
    });
  }
  for (const row of flagged) {
    alerts.push({
      id: `flag-${row.id}`,
      severity: "info",
      text: `${row.trainee.fullName} left the exam window ${row.blurCount} time${row.blurCount === 1 ? "" : "s"}.`,
      at: row.createdAt.toISOString(),
      link: `/exams/${row.courseId}/attempts/${row.id}`,
    });
  }
  for (const course of emptyBanks) {
    alerts.push({
      id: `bank-${course.id}`,
      severity: "warning",
      text: `${course.name} has no exam questions yet.`,
      at: now.toISOString(),
      link: `/exams/${course.id}`,
    });
  }

  return apiOk({
    metrics: {
      totalTrainees: { value: totalTrainees, newThisMonth },
      activeCourses: { value: activeCourses },
      completed: { value: certsThisQuarter },
      examsInProgress: { value: sittingsOpen },
      certificatesThisMonth: { value: certsThisMonth, changePct: pctChange(certsThisMonth, certsLastMonth) },
    },
    categories,
    alerts: alerts.slice(0, 6),
    deadlines: deadlineRows.map((row) => ({
      traineeId: row.id,
      traineeName: row.fullName,
      courseName: row.course?.name ?? "",
      deadline: (row.deadlineAt as Date).toISOString(),
      daysLeft: Math.ceil(((row.deadlineAt as Date).getTime() - now.getTime()) / DAY_MS),
    })),
    activity: audit.map((row) => ({
      id: row.id,
      actorName: row.actorEmail ?? "System",
      action: ACTION_TEXT[row.action] ?? row.action.replaceAll(".", " "),
      at: row.createdAt.toISOString(),
    })),
    revenue,
    passRates,
    trainerScoped: isTrainer,
  });
}
