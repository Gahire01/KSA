import {
  differenceInCalendarDays,
  format,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

import { seededFromString } from "@/lib/utils/ids";
import {
  CATEGORIES,
  type ActivityRow,
  type AlertRow,
  type CategoryDatum,
  type DashboardData,
  type DeadlineRow,
  type PassRateDatum,
  type RevenuePoint,
} from "@/lib/types";
import { MOCK_NOW, courseById, courses } from "./courses";
import { attempts } from "./attempts";
import { auditEntries } from "./audit-log";
import { payments } from "./payments";
import { trainees } from "./trainees";

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function attendanceSparkline(): number[] {
  const rnd = seededFromString("ksa-attendance-spark");
  const out: number[] = [];
  let value = 62;
  for (let i = 0; i < 14; i += 1) {
    value = Math.max(38, Math.min(96, value + (rnd() - 0.45) * 12));
    out.push(Math.round(value));
  }
  return out;
}

export function buildDashboard(trainerId?: string): DashboardData {
  const scopedCourseIds = trainerId
    ? new Set(courses.filter((c) => c.trainerId === trainerId).map((c) => c.id))
    : null;
  const scoped = scopedCourseIds
    ? trainees.filter((t) => scopedCourseIds.has(t.courseId))
    : trainees;

  const all = trainees;
  const total = all.length;
  const active = all.filter((t) => t.status === "ACTIVE").length;
  const completed = all.filter((t) => t.status === "COMPLETED").length;
  const pending = all.filter((t) => t.status === "PENDING").length;
  const enrolledLast30 = all.filter(
    (t) => differenceInCalendarDays(MOCK_NOW, new Date(t.enrolledAt)) <= 30,
  ).length;

  const categories: CategoryDatum[] = CATEGORIES.map((category) => ({
    category,
    count: all.filter(
      (t) => t.category === category && (!scopedCourseIds || scopedCourseIds.has(t.courseId)),
    ).length,
  })).sort((a, b) => b.count - a.count);

  const deadlines: DeadlineRow[] = scoped
    .filter((t) => t.status === "ACTIVE" || t.status === "PENDING")
    .map((t) => ({
      traineeId: t.id,
      traineeName: t.name,
      courseName: courseById.get(t.courseId)?.name ?? "—",
      deadline: t.deadline,
      daysLeft: differenceInCalendarDays(new Date(t.deadline), MOCK_NOW),
    }))
    .filter((d) => d.daysLeft >= -3)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  const alerts: AlertRow[] = [];
  const flagged = attempts.filter((a) => a.integrityFlags.length >= 3).length;
  const unpaid = scoped.filter((t) => t.paymentStatus === "UNPAID").length;
  const dueSoon = deadlines.filter((d) => d.daysLeft <= 7).length;
  const voided = attempts.filter((a) => a.status === "VOID").length;
  const plural = (n: number, s: string, p = `${s}s`) => (n === 1 ? s : p);

  if (dueSoon > 0) {
    alerts.push({
      id: "alt_due",
      severity: dueSoon <= 2 ? "critical" : "warning",
      text: `${dueSoon} ${plural(dueSoon, "trainee has", "trainees have")} an exam due within 7 days`,
      at: subDays(MOCK_NOW, 0).toISOString(),
      link: "/trainees?status=ACTIVE",
    });
  }
  if (unpaid > 0) {
    alerts.push({
      id: "alt_unpaid",
      severity: "warning",
      text: `${unpaid} ${plural(unpaid, "enrolment is", "enrolments are")} awaiting payment`,
      at: subDays(MOCK_NOW, 1).toISOString(),
      link: "/payments?status=UNPAID",
    });
  }
  if (flagged > 0) {
    alerts.push({
      id: "alt_integrity",
      severity: "critical",
      text: `${flagged} ${plural(flagged, "attempt has", "attempts have")} multiple integrity flags to review`,
      at: subDays(MOCK_NOW, 2).toISOString(),
      link: "/exams?filter=flagged",
    });
  }
  if (voided > 0) {
    alerts.push({
      id: "alt_void",
      severity: "info",
      text: `${voided} ${plural(voided, "attempt was", "attempts were")} voided this cycle`,
      at: subDays(MOCK_NOW, 4).toISOString(),
      link: "/exams",
    });
  }
  if (pending > 0) {
    alerts.push({
      id: "alt_pending",
      severity: "info",
      text: `${pending} ${plural(pending, "trainee is", "trainees are")} pending enrolment confirmation`,
      at: subDays(MOCK_NOW, 5).toISOString(),
      link: "/trainees?status=PENDING",
    });
  }

  const activity: ActivityRow[] = auditEntries.slice(0, 8).map((a) => ({
    id: a.id,
    actorName: a.actorName,
    action: a.action,
    target: a.entityLabel,
    at: a.at,
  }));

  const revenue: RevenuePoint[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const monthStart = startOfMonth(subMonths(MOCK_NOW, i));
    const monthKey = format(monthStart, "yyyy-MM");
    const collected = payments
      .filter((p) => p.paidAt.startsWith(monthKey) && p.status !== "UNPAID")
      .reduce((s, p) => s + p.amountRwf, 0);
    const rnd = seededFromString(`rev-${monthKey}`);
    const fallback = 3_200_000 + Math.floor(rnd() * 2_400_000);
    const value = collected > 0 ? collected : fallback;
    revenue.push({
      month: format(monthStart, "MMM yyyy"),
      collectedRwf: value,
      invoiceRwf: Math.round((value * (1.08 + rnd() * 0.14)) / 5000) * 5000,
    });
  }

  const passRates: PassRateDatum[] = courses
    .filter((c) => !scopedCourseIds || scopedCourseIds.has(c.id))
    .map((c) => {
      const graded = attempts.filter(
        (a) => a.courseId === c.id && (a.status === "PASSED" || a.status === "FAILED"),
      );
      const passed = graded.filter((a) => a.status === "PASSED").length;
      return {
        courseId: c.id,
        courseName: c.name,
        passRate: graded.length > 0 ? Math.round((passed / graded.length) * 100) : 0,
        attempts: attempts.filter((a) => a.courseId === c.id).length,
        averageScore:
          graded.length > 0
            ? Math.round(graded.reduce((s, a) => s + (a.score ?? 0), 0) / graded.length)
            : 0,
      };
    })
    .sort((a, b) => b.passRate - a.passRate);

  return {
    metrics: {
      totalTrainees: { value: total, changePct: pctChange(total, enrolledLast30) },
      active: { value: active, changePct: pctChange(active, active - 3) },
      completed: { value: completed, changePct: pctChange(completed, completed - 2) },
      pending: { value: pending, changePct: pctChange(pending, pending + 1) },
      todayAttendance: { value: 38, changePct: 4.2, spark: attendanceSparkline() },
    },
    categories,
    alerts: alerts.slice(0, 6),
    deadlines,
    activity,
    revenue,
    passRates,
    trainerScoped: Boolean(trainerId),
  };
}
