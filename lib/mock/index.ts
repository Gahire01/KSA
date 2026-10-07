import {
  addDays,
  addMonths,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";

import { generateCertNo, generateContentHash, generateReceiptNo, generateToken } from "@/lib/utils/ids";
import { shuffle } from "@/lib/utils/shuffle";
import { ACADEMY } from "@/lib/academy/constants";
import type {
  AcademySettings,
  AttemptFilters,
  AuditEntry,
  AuditFilters,
  Certificate,
  CertificateFilters,
  CertificateStatus,
  Course,
  DashboardData,
  Difficulty,
  Exam,
  ExamAttempt,
  NotificationType,
  Paginated,
  Payment,
  PaymentFilters,
  Question,
  ReportFormat,
  ReportType,
  Session,
  SortSpec,
  Trainee,
  TraineeFilters,
  Trainer,
} from "@/lib/types";
import { MOCK_NOW, courses, reportDefinitions } from "./courses";
import { trainers } from "./trainers";
import { questions, questionsByCourse } from "./questions";
import { enrollments, traineeById, trainees } from "./trainees";
import { exams, examById } from "./exams";
import { attemptByToken, attempts } from "./attempts";
import { certificates } from "./certificates";
import { payments, recorderNames } from "./payments";
import { auditEntries } from "./audit-log";
import { buildDashboard } from "./dashboard";

/* ═══════════════════════════════════════════════════════════════
   Simulated network layer
   ═══════════════════════════════════════════════════════════════ */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Every fetcher goes through here so latency feels consistent. */
export async function withLatency<T>(value: () => T): Promise<T> {
  await sleep(300 + Math.random() * 300);
  return value();
}

function paginate<T>(rows: T[], page = 1, pageSize = 20): Paginated<T> {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    pageCount,
  };
}

function sortRows<T>(rows: T[], sort: SortSpec | undefined, accessors: Record<string, (r: T) => string | number>): T[] {
  if (!sort) return rows;
  const getter = accessors[sort.id];
  if (!getter) return rows;
  const dir = sort.desc ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

function inRange(value: string, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const d = parseISO(value);
  if (from && isBefore(d, parseISO(from))) return false;
  if (to && isAfter(d, parseISO(`${to}T23:59:59.999Z`))) return false;
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   Local mutation log (keeps the UI feeling live without a backend)
   ═══════════════════════════════════════════════════════════════ */

type LiveChange = { kind: "trainee" | "payment" | "certificate" | "exam"; at: number };
const liveChanges: LiveChange[] = [];
export function recordChange(kind: LiveChange["kind"]): void {
  liveChanges.unshift({ kind, at: Date.now() });
  if (liveChanges.length > 40) liveChanges.pop();
}
export function changesSince(msAgo: number): number {
  const cutoff = Date.now() - msAgo;
  return liveChanges.filter((c) => c.at >= cutoff).length;
}

/* ═══════════════════════════════════════════════════════════════
   Settings + sessions
   ═══════════════════════════════════════════════════════════════ */

const defaultMatrix: Record<NotificationType, Record<"inapp" | "email" | "whatsapp", boolean>> = {
  "exam.sent": { inapp: true, email: true, whatsapp: true },
  "exam.submitted": { inapp: true, email: true, whatsapp: false },
  "exam.passed": { inapp: true, email: true, whatsapp: false },
  "exam.failed": { inapp: true, email: true, whatsapp: false },
  "payment.recorded": { inapp: true, email: true, whatsapp: true },
  "trainee.enrolled": { inapp: true, email: false, whatsapp: false },
  "deadline.approaching": { inapp: true, email: true, whatsapp: true },
  "certificate.issued": { inapp: true, email: true, whatsapp: false },
  "exam.link.expiring": { inapp: true, email: true, whatsapp: true },
  system: { inapp: true, email: false, whatsapp: false },
};

let settings: AcademySettings = {
  name: ACADEMY.name,
  tagline: ACADEMY.tagline,
  address: ACADEMY.address,
  city: ACADEMY.city,
  country: ACADEMY.country,
  phone: ACADEMY.phone,
  email: ACADEMY.email,
  website: ACADEMY.website,
  logoUrl: "/logo.png",
  defaultSignerTrainerId: "trn_001",
  defaultPassMarkPct: 70,
  currency: "RWF",
  digestMode: "instant",
  notificationMatrix: defaultMatrix,
};

const sessions: Session[] = [
  {
    id: "ses_current",
    device: "MacBook Pro 14\"",
    browser: "Chrome 129 · macOS 17.4",
    ip: "41.186.22.104",
    location: "Kigali, Rwanda",
    lastActiveAt: new Date().toISOString(),
    current: true,
  },
  {
    id: "ses_2",
    device: "iPhone 15",
    browser: "Safari 17 · iOS 17.4",
    ip: "102.168.14.77",
    location: "Kigali, Rwanda",
    lastActiveAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    current: false,
  },
  {
    id: "ses_3",
    device: "Windows workstation 04",
    browser: "Edge 129 · Windows 11",
    ip: "197.157.18.201",
    location: "Nairobi, Kenya",
    lastActiveAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    current: false,
  },
  {
    id: "ses_4",
    device: "Pixel 8",
    browser: "Chrome 129 · Android 14",
    ip: "185.12.44.9",
    location: "Kigali, Rwanda",
    lastActiveAt: new Date(Date.now() - 51 * 3_600_000).toISOString(),
    current: false,
  },
];

/* ═══════════════════════════════════════════════════════════════
   Mock API
   ═══════════════════════════════════════════════════════════════ */

export const mockApi = {
  /* ── Courses ───────────────────────────────────────────────── */
  courses: {
    async list(): Promise<Course[]> {
      return withLatency(() => courses.slice());
    },
    async get(id: string): Promise<Course | null> {
      return withLatency(() => courses.find((c) => c.id === id) ?? null);
    },
    async create(input: Partial<Course>): Promise<Course> {
      return withLatency(() => {
        const course: Course = {
          id: `crs_${Date.now().toString(36)}`,
          code: (input.code ?? "NEW").toUpperCase(),
          name: input.name ?? "Untitled course",
          category: input.category ?? "Firefighters",
          description: input.description ?? "",
          durationValue: input.durationValue ?? 1,
          durationUnit: input.durationUnit ?? "day",
          priceRwf: input.priceRwf ?? 0,
          passMarkPct: input.passMarkPct ?? 70,
          maxAttempts: input.maxAttempts ?? 3,
          validityMonths: input.validityMonths ?? 12,
          examDurationMin: input.examDurationMin ?? 45,
          trainerId: input.trainerId ?? "trn_001",
          questionCount: 0,
          isActive: input.isActive ?? true,
          enrolledCount: 0,
          createdAt: new Date().toISOString(),
        };
        courses.push(course);
        recordChange("exam");
        return course;
      });
    },
    async update(id: string, input: Partial<Course>): Promise<Course | null> {
      return withLatency(() => {
        const idx = courses.findIndex((c) => c.id === id);
        if (idx < 0) return null;
        const next: Course = { ...courses[idx]!, ...input };
        courses[idx] = next;
        return next;
      });
    },
    async analytics(courseId: string) {
      return withLatency(() => {
        const course = courses.find((c) => c.id === courseId);
        const rows = attempts.filter((a) => a.courseId === courseId);
        const graded = rows.filter((a) => a.status === "PASSED" || a.status === "FAILED");
        const bank = questionsByCourse.get(courseId) ?? [];
        return {
          passRate: graded.length ? Math.round((graded.filter((a) => a.status === "PASSED").length / graded.length) * 100) : 0,
          averageScore: graded.length
            ? Math.round(graded.reduce((s, a) => s + (a.score ?? 0), 0) / graded.length)
            : 0,
          attemptsDistribution: {
            passed: rows.filter((a) => a.status === "PASSED").length,
            failed: rows.filter((a) => a.status === "FAILED").length,
            inProgress: rows.filter((a) => a.status === "STARTED" || a.status === "SENT").length,
            voided: rows.filter((a) => a.status === "VOID").length,
          },
          questionSuccess: bank.map((q) => ({
            id: q.id,
            text: q.text,
            difficulty: q.difficulty,
            successRate: q.timesServed
              ? Math.round((q.timesCorrect / q.timesServed) * 100)
              : 0,
            timesServed: q.timesServed,
          })),
          passMark: course?.passMarkPct ?? 70,
        };
      });
    },
  },

  /* ── Trainers ──────────────────────────────────────────────── */
  trainers: {
    async list(): Promise<Trainer[]> {
      return withLatency(() => trainers.slice());
    },
    async get(id: string): Promise<Trainer | null> {
      return withLatency(() => trainers.find((t) => t.id === id) ?? null);
    },
    async update(id: string, input: Partial<Trainer>): Promise<Trainer | null> {
      return withLatency(() => {
        const idx = trainers.findIndex((t) => t.id === id);
        if (idx < 0) return null;
        const next = { ...trainers[idx]!, ...input };
        trainers[idx] = next;
        return next;
      });
    },
    async activity(id: string) {
      return withLatency(() => {
        const issued = certificates.filter((c) => c.trainerId === id).slice(0, 6);
        const sent = attempts.filter((a) => a.examId).slice(0, 6);
        return {
          certificates: issued,
          exams: sent,
          logins: [
            { at: new Date(Date.now() - 4 * 3_600_000).toISOString(), device: "Chrome · Windows 11" },
            { at: new Date(Date.now() - 28 * 3_600_000).toISOString(), device: "Safari · iOS 17" },
            { at: new Date(Date.now() - 74 * 3_600_000).toISOString(), device: "Chrome · macOS" },
          ],
          cohortLoad: courses
            .filter((c) => c.trainerId === id)
            .map((c) => ({ courseId: c.id, name: c.name, enrolled: c.enrolledCount })),
        };
      });
    },
  },

  /* ── Questions ─────────────────────────────────────────────── */
  questions: {
    async listByCourse(courseId: string): Promise<Question[]> {
      return withLatency(() => (questionsByCourse.get(courseId) ?? []).slice().sort((a, b) => a.position - b.position));
    },
    async create(input: {
      courseId: string;
      text: string;
      options: string[];
      correctIndex: number;
      difficulty: Difficulty;
      explanation: string;
    }): Promise<Question> {
      return withLatency(() => {
        const id = `qst_${Date.now().toString(36)}`;
        const question: Question = {
          id,
          courseId: input.courseId,
          text: input.text,
          options: input.options.map((text, i) => ({
            id: `${id}_o${i + 1}`,
            text,
            isCorrect: i === input.correctIndex,
          })),
          difficulty: input.difficulty,
          explanation: input.explanation,
          position: (questionsByCourse.get(input.courseId)?.length ?? 0) + 1,
          timesServed: 0,
          timesCorrect: 0,
        };
        questions.push(question);
        const list = questionsByCourse.get(input.courseId) ?? [];
        list.push(question);
        questionsByCourse.set(input.courseId, list);
        const course = courses.find((c) => c.id === input.courseId);
        if (course) course.questionCount = list.length;
        return question;
      });
    },
    async update(id: string, input: Partial<Question>): Promise<Question | null> {
      return withLatency(() => {
        const idx = questions.findIndex((q) => q.id === id);
        if (idx < 0) return null;
        const next = { ...questions[idx]!, ...input };
        questions[idx] = next;
        return next;
      });
    },
    async remove(id: string): Promise<boolean> {
      return withLatency(() => {
        const idx = questions.findIndex((q) => q.id === id);
        if (idx < 0) return false;
        const [removed] = questions.splice(idx, 1);
        if (removed) {
          const list = questionsByCourse.get(removed.courseId);
          if (list) questionsByCourse.set(removed.courseId, list.filter((q) => q.id !== id));
        }
        return true;
      });
    },
    async reorder(courseId: string, orderedIds: string[]): Promise<Question[]> {
      return withLatency(() => {
        const list = questionsByCourse.get(courseId) ?? [];
        orderedIds.forEach((id, i) => {
          const q = list.find((x) => x.id === id);
          if (q) q.position = i + 1;
        });
        list.sort((a, b) => a.position - b.position);
        questionsByCourse.set(courseId, list);
        return list.slice();
      });
    },
  },

  /* ── Trainees ──────────────────────────────────────────────── */
  trainees: {
    async list(filters: TraineeFilters = {}, scopeCourseIds?: string[]): Promise<Paginated<Trainee>> {
      return withLatency(() => {
        let rows = trainees.slice();
        if (scopeCourseIds && scopeCourseIds.length > 0) {
          rows = rows.filter((t) => scopeCourseIds.includes(t.courseId));
        }
        if (filters.search) {
          const q = filters.search.toLowerCase();
          rows = rows.filter(
            (t) =>
              t.name.toLowerCase().includes(q) ||
              t.email.toLowerCase().includes(q) ||
              t.traineeNo.toLowerCase().includes(q) ||
              t.phone.includes(q),
          );
        }
        if (filters.categories?.length) rows = rows.filter((t) => filters.categories!.includes(t.category));
        if (filters.courseIds?.length) rows = rows.filter((t) => filters.courseIds!.includes(t.courseId));
        if (filters.statuses?.length) rows = rows.filter((t) => filters.statuses!.includes(t.status));
        if (filters.paymentStatuses?.length) rows = rows.filter((t) => filters.paymentStatuses!.includes(t.paymentStatus));
        if (filters.countries?.length) rows = rows.filter((t) => filters.countries!.includes(t.country));
        if (filters.enrolledFrom || filters.enrolledTo) {
          rows = rows.filter((t) => inRange(t.enrolledAt, filters.enrolledFrom, filters.enrolledTo));
        }

        rows = sortRows(rows, filters.sort, {
          name: (t) => t.name,
          traineeNo: (t) => t.traineeNo,
          course: (t) => courses.find((c) => c.id === t.courseId)?.code ?? "",
          country: (t) => t.country,
          status: (t) => t.status,
          paymentStatus: (t) => t.paymentStatus,
          enrolledAt: (t) => t.enrolledAt,
          deadline: (t) => t.deadline,
        });

        return paginate(rows, filters.page, filters.pageSize);
      });
    },
    async all(scopeCourseIds?: string[]): Promise<Trainee[]> {
      return withLatency(() =>
        scopeCourseIds && scopeCourseIds.length > 0
          ? trainees.filter((t) => scopeCourseIds.includes(t.courseId))
          : trainees.slice(),
      );
    },
    async get(id: string): Promise<Trainee | null> {
      return withLatency(() => traineeById.get(id) ?? null);
    },
    async detail(id: string) {
      return withLatency(() => {
        const trainee = traineeById.get(id);
        if (!trainee) return null;
        return {
          trainee,
          enrollments: enrollments.filter((e) => e.traineeId === id),
          payments: payments.filter((p) => p.traineeId === id),
          attempts: attempts.filter((a) => a.traineeId === id),
          certificates: certificates.filter((c) => c.traineeId === id),
          timeline: [],
        };
      });
    },
    async create(input: Partial<Trainee>): Promise<Trainee> {
      return withLatency(() => {
        const course = courses.find((c) => c.id === input.courseId) ?? courses[0]!;
        const sequence = trainees.length + 1;
        const year = new Date().getFullYear();
        const now = new Date().toISOString();
        const trainee: Trainee = {
          id: `trn_t${String(trainees.length + 1).padStart(3, "0")}`,
          traineeNo: `${course.code}-${year}-${String(sequence).padStart(4, "0")}`,
          name: input.name ?? "New trainee",
          email: input.email ?? "",
          phone: input.phone ?? "",
          country: input.country ?? "Rwanda",
          category: course.category,
          status: input.status ?? "ACTIVE",
          paymentStatus: input.paymentStatus ?? "UNPAID",
          amountPaidRwf: input.amountPaidRwf ?? 0,
          totalDueRwf: course.priceRwf,
          courseId: course.id,
          enrolledAt: input.enrolledAt ?? now,
          deadline: input.deadline ?? addDays(new Date(input.enrolledAt ?? now), course.durationValue * 30).toISOString(),
          attendancePct: 0,
          examScore: null,
          notes: input.notes ?? "",
          createdAt: now,
          updatedAt: now,
        };
        trainees.unshift(trainee);
        course.enrolledCount += 1;
        recordChange("trainee");
        return trainee;
      });
    },
    async update(id: string, input: Partial<Trainee>): Promise<Trainee | null> {
      return withLatency(() => {
        const idx = trainees.findIndex((t) => t.id === id);
        if (idx < 0) return null;
        const next: Trainee = { ...trainees[idx]!, ...input, updatedAt: new Date().toISOString() };
        trainees[idx] = next;
        recordChange("trainee");
        return next;
      });
    },
    async remove(id: string): Promise<boolean> {
      return withLatency(() => {
        const idx = trainees.findIndex((t) => t.id === id);
        if (idx < 0) return false;
        trainees.splice(idx, 1);
        recordChange("trainee");
        return true;
      });
    },
    async importBulk(rows: Trainee[]): Promise<number> {
      return withLatency(() => {
        for (const row of rows) {
          trainees.unshift(row);
          const course = courses.find((c) => c.id === row.courseId);
          if (course) course.enrolledCount += 1;
        }
        recordChange("trainee");
        return rows.length;
      });
    },
    async previewId(courseId: string): Promise<string> {
      return withLatency(() => {
        const course = courses.find((c) => c.id === courseId) ?? courses[0]!;
        return `${course.code}-${new Date().getFullYear()}-${String(trainees.length + 1).padStart(4, "0")}`;
      });
    },
  },

  /* ── Exams ─────────────────────────────────────────────────── */
  exams: {
    async list(filters: { status?: string; search?: string } = {}, scopeCourseIds?: string[]): Promise<Exam[]> {
      return withLatency(() => {
        let rows = exams.slice();
        if (scopeCourseIds && scopeCourseIds.length > 0) {
          rows = rows.filter((e) => scopeCourseIds.includes(e.courseId));
        }
        if (filters.status && filters.status !== "ALL") {
          rows = rows.filter((e) => e.status === filters.status);
        }
        if (filters.search) {
          const q = filters.search.toLowerCase();
          rows = rows.filter(
            (e) =>
              e.title.toLowerCase().includes(q) ||
              courses.find((c) => c.id === e.courseId)?.name.toLowerCase().includes(q),
          );
        }
        return rows;
      });
    },
    async get(id: string): Promise<Exam | null> {
      return withLatency(() => exams.find((e) => e.id === id) ?? null);
    },
    async create(input: {
      courseId: string;
      title: string;
      questionsToServe: number;
      durationMin: number;
      passMarkPct: number;
      maxAttempts: number;
      shuffleQuestions: boolean;
      shuffleOptions: boolean;
      opensAt: string | null;
      closesAt: string | null;
    }): Promise<Exam> {
      return withLatency(() => {
        const course = courses.find((c) => c.id === input.courseId) ?? courses[0]!;
        const now = new Date();
        const isFuture = input.opensAt ? new Date(input.opensAt) > now : false;
        const exam: Exam = {
          id: `exm_${String(exams.length + 1).padStart(3, "0")}`,
          courseId: course.id,
          title: input.title,
          status: isFuture ? "SCHEDULED" : "ACTIVE",
          questionsToServe: input.questionsToServe,
          questionCount: course.questionCount,
          durationMin: input.durationMin,
          passMarkPct: input.passMarkPct,
          maxAttempts: input.maxAttempts,
          shuffleQuestions: input.shuffleQuestions,
          shuffleOptions: input.shuffleOptions,
          sentAt: null,
          recipientsCount: 0,
          opensAt: input.opensAt,
          closesAt: input.closesAt,
          createdAt: now.toISOString(),
          trainerId: course.trainerId,
        };
        exams.unshift(exam);
        recordChange("exam");
        return exam;
      });
    },
    async update(id: string, input: Partial<Exam>): Promise<Exam | null> {
      return withLatency(() => {
        const idx = exams.findIndex((e) => e.id === id);
        if (idx < 0) return null;
        const next: Exam = { ...exams[idx]!, ...input };
        exams[idx] = next;
        return next;
      });
    },
    /** Trainees who would receive a link for a course, before the exam exists. */
    async previewRecipients(courseId: string) {
      return withLatency(() => trainees.filter((t) => t.courseId === courseId));
    },
    async recipients(examId: string) {
      return withLatency(() => {
        const exam = examById.get(examId);
        if (!exam) return [];
        const enrolled = trainees.filter((t) => t.courseId === exam.courseId);
        const withAttempt = new Map(attempts.filter((a) => a.examId === examId).map((a) => [a.traineeId, a]));
        return enrolled.map((t) => {
          const attempt = withAttempt.get(t.id);
          return {
            trainee: t,
            attempt: attempt ?? null,
            status: attempt?.status ?? "NOT_SENT",
            token: attempt?.token ?? generateToken("exm", `${examId}-${t.id}`),
          };
        });
      });
    },
    async sendLinks(examId: string, traineeIds: string[]): Promise<number> {
      return withLatency(() => {
        const exam = examById.get(examId);
        if (!exam) return 0;
        let sent = 0;
        for (const traineeId of traineeIds) {
          if (attempts.some((a) => a.examId === examId && a.traineeId === traineeId)) continue;
          const id = `att_${String(attempts.length + 1).padStart(3, "0")}`;
          const token = generateToken("exm", `${examId}-${traineeId}`);
          const bank = questionsByCourse.get(exam.courseId) ?? [];
          const served = shuffle(bank, token).slice(0, exam.questionsToServe || bank.length);
          const attempt: ExamAttempt = {
            id,
            examId: exam.id,
            traineeId,
            courseId: exam.courseId,
            token,
            status: "SENT",
            attemptNumber: 1,
            score: null,
            correctCount: null,
            questionCount: served.length,
            startedAt: null,
            submittedAt: null,
            durationUsedSec: null,
            ip: "—",
            userAgent: "—",
            integrityFlags: [],
            answers: {},
            perQuestion: [],
          };
          attempts.unshift(attempt);
          sent += 1;
        }
        exam.recipientsCount = attempts.filter((a) => a.examId === examId).length;
        if (!exam.sentAt) exam.sentAt = new Date().toISOString();
        recordChange("exam");
        return sent;
      });
    },
  },

  /* ── Attempts ──────────────────────────────────────────────── */
  attempts: {
    async list(filters: AttemptFilters & { examId?: string } = {}): Promise<ExamAttempt[]> {
      return withLatency(() => {
        let rows = attempts.slice();
        if (filters.examId) rows = rows.filter((a) => a.examId === filters.examId);
        if (filters.statuses?.length) rows = rows.filter((a) => filters.statuses!.includes(a.status));
        if (filters.flaggedOnly) rows = rows.filter((a) => a.integrityFlags.length > 0);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          rows = rows.filter(
            (a) => (traineeById.get(a.traineeId)?.name.toLowerCase().includes(q) ?? false),
          );
        }
        return rows;
      });
    },
    async get(id: string): Promise<ExamAttempt | null> {
      return withLatency(() => attempts.find((a) => a.id === id) ?? null);
    },
    async byToken(token: string) {
      return withLatency(() => {
        const attempt = attemptByToken.get(token);
        if (!attempt) return null;
        const exam = examById.get(attempt.examId) ?? null;
        const course = courses.find((c) => c.id === attempt.courseId) ?? null;
        const trainee = traineeById.get(attempt.traineeId) ?? null;
        const bank = questionsByCourse.get(attempt.courseId) ?? [];
        const served = shuffle(bank, attempt.token).slice(
          0,
          attempt.perQuestion.length > 0
            ? attempt.perQuestion.length
            : exam?.questionsToServe || bank.length,
        );
        return { attempt, exam, course, trainee, questions: served };
      });
    },
    async saveProgress(token: string, answers: Record<string, string>, blurCount: number) {
      return withLatency(() => {
        const attempt = attemptByToken.get(token);
        if (!attempt) return null;
        attempt.answers = { ...attempt.answers, ...answers };
        if (!attempt.startedAt) {
          attempt.startedAt = new Date().toISOString();
          attempt.status = "STARTED";
        }
        if (blurCount > 0 && attempt.integrityFlags.filter((f) => f.type === "TAB_BLUR").length < blurCount) {
          for (let i = attempt.integrityFlags.filter((f) => f.type === "TAB_BLUR").length; i < blurCount; i += 1) {
            attempt.integrityFlags.push({
              id: `flg_live_${attempt.id}_${i}`,
              type: "TAB_BLUR",
              at: new Date().toISOString(),
              detail: "Browser window lost focus",
            });
          }
        }
        return attempt;
      });
    },
    async submit(token: string, answers: Record<string, string>, blurCount: number) {
      return withLatency(() => {
        const attempt = attemptByToken.get(token);
        if (!attempt) return null;
        const exam = examById.get(attempt.examId);
        const bank = questionsByCourse.get(attempt.courseId) ?? [];
        const served = shuffle(bank, attempt.token).slice(0, attempt.questionCount || bank.length);

        const perQuestion = served.map((q) => {
          const correct = q.options.find((o) => o.isCorrect);
          const selectedId = answers[q.id] ?? "";
          return {
            questionId: q.id,
            selectedOptionId: selectedId || null,
            correctOptionId: correct?.id ?? "",
            isCorrect: selectedId === correct?.id,
            timeSpentSec: 0,
          };
        });
        const correctCount = perQuestion.filter((p) => p.isCorrect).length;
        const score = perQuestion.length
          ? Math.round((correctCount / perQuestion.length) * 100)
          : 0;
        const started = attempt.startedAt ? new Date(attempt.startedAt) : new Date();
        const durationUsedSec = Math.max(
          1,
          Math.round((Date.now() - started.getTime()) / 1000),
        );

        attempt.answers = answers;
        attempt.perQuestion = perQuestion;
        attempt.correctCount = correctCount;
        attempt.score = score;
        attempt.status = score >= (exam?.passMarkPct ?? 70) ? "PASSED" : "FAILED";
        attempt.submittedAt = new Date().toISOString();
        attempt.durationUsedSec = Math.min(durationUsedSec, (exam?.durationMin ?? 45) * 60);
        attempt.ip = attempt.ip === "—" ? "41.186.64.12" : attempt.ip;
        attempt.userAgent =
          attempt.userAgent === "—" && typeof navigator !== "undefined"
            ? navigator.userAgent
            : attempt.userAgent;
        for (let i = attempt.integrityFlags.filter((f) => f.type === "TAB_BLUR").length; i < blurCount; i += 1) {
          attempt.integrityFlags.push({
            id: `flg_live_${attempt.id}_${i}`,
            type: "TAB_BLUR",
            at: new Date().toISOString(),
            detail: "Browser window lost focus",
          });
        }

        let certificate: Certificate | null = null;
        if (attempt.status === "PASSED" && attempt.courseId) {
          certificate = {
            id: `crt_${String(certificates.length + 1).padStart(3, "0")}`,
            certNo: generateCertNo(new Date().getFullYear(), certificates.length + 1),
            verificationToken: generateToken("vfy", `${attempt.id}-${Date.now()}`),
            traineeId: attempt.traineeId,
            courseId: attempt.courseId,
            examId: attempt.examId,
            attemptId: attempt.id,
            trainerId: exam?.trainerId ?? "trn_001",
            status: "VALID",
            score,
            durationLabel: `${exam?.durationMin ?? 45} min · ${served.length} questions`,
            issuedAt: new Date().toISOString(),
            expiresAt:
              courses.find((c) => c.id === attempt.courseId)?.validityMonths
                ? addMonths(new Date(), courses.find((c) => c.id === attempt.courseId)!.validityMonths!).toISOString()
                : null,
            revokedAt: null,
            revokeReason: null,
            contentHash: generateContentHash(`${attempt.id}-${Date.now()}`),
            pdfKey: `certs/${new Date().getFullYear()}/live-${attempt.id}.pdf`,
          };
          certificates.unshift(certificate);
          recordChange("certificate");
        }
        recordChange("exam");
        return { attempt, certificate };
      });
    },
    async void(id: string, reason: string): Promise<ExamAttempt | null> {
      return withLatency(() => {
        const attempt = attempts.find((a) => a.id === id);
        if (!attempt) return null;
        attempt.status = "VOID";
        attempt.voidedReason = reason;
        return attempt;
      });
    },
  },

  /* ── Certificates ──────────────────────────────────────────── */
  certificates: {
    async list(
      filters: CertificateFilters = {},
      scopeCourseIds?: string[],
    ): Promise<Paginated<Certificate>> {
      return withLatency(() => {
        let rows = certificates.slice();
        if (scopeCourseIds && scopeCourseIds.length > 0) {
          rows = rows.filter((c) => scopeCourseIds.includes(c.courseId));
        }
        if (filters.search) {
          const q = filters.search.toLowerCase();
          rows = rows.filter((c) => {
            const name = traineeById.get(c.traineeId)?.name.toLowerCase() ?? "";
            return (
              c.certNo.toLowerCase().includes(q) ||
              name.includes(q) ||
              (courses.find((x) => x.id === c.courseId)?.name.toLowerCase().includes(q) ?? false)
            );
          });
        }
        if (filters.courseIds?.length) rows = rows.filter((c) => filters.courseIds!.includes(c.courseId));
        if (filters.statuses?.length) rows = rows.filter((c) => filters.statuses!.includes(c.status));
        if (filters.trainerIds?.length) rows = rows.filter((c) => filters.trainerIds!.includes(c.trainerId));
        if (filters.issuedFrom || filters.issuedTo) {
          rows = rows.filter((c) => inRange(c.issuedAt, filters.issuedFrom, filters.issuedTo));
        }
        rows = sortRows(rows, filters.sort, {
          certNo: (c) => c.certNo,
          issuedAt: (c) => c.issuedAt,
          expiresAt: (c) => c.expiresAt ?? "9999",
          status: (c) => c.status,
        });
        return paginate(rows, filters.page, filters.pageSize);
      });
    },
    async get(id: string): Promise<Certificate | null> {
      return withLatency(() => certificates.find((c) => c.id === id) ?? null);
    },
    async byToken(token: string) {
      return withLatency(() => {
        const needle = token.trim().toLowerCase();
        const cert =
          certificates.find((c) => c.verificationToken.toLowerCase() === needle) ??
          certificates.find((c) => c.certNo.toLowerCase() === needle) ??
          null;
        if (!cert) return null;
        return {
          certificate: cert,
          trainee: traineeById.get(cert.traineeId) ?? null,
          course: courses.find((c) => c.id === cert.courseId) ?? null,
          trainer: trainers.find((t) => t.id === cert.trainerId) ?? null,
        };
      });
    },
    async issueForTrainee(traineeId: string, courseId: string) {
      return withLatency(() => {
        const existing = certificates.find(
          (c) => c.traineeId === traineeId && c.courseId === courseId && c.status !== "REVOKED",
        );
        if (existing) return existing;
        const course = courses.find((c) => c.id === courseId) ?? courses[0]!;
        const certNo = generateCertNo(new Date().getFullYear(), certificates.length + 1);
        const cert: Certificate = {
          id: `crt_${String(certificates.length + 1).padStart(3, "0")}`,
          certNo,
          verificationToken: generateToken("vfy", `${traineeId}-${courseId}-${Date.now()}`),
          traineeId,
          courseId,
          examId: "",
          attemptId: "",
          trainerId: course.trainerId,
          status: "VALID",
          score: traineeById.get(traineeId)?.examScore ?? 80,
          durationLabel: `${course.durationValue} ${course.durationUnit}s · on-site assessment`,
          issuedAt: new Date().toISOString(),
          expiresAt: course.validityMonths
            ? addMonths(new Date(), course.validityMonths).toISOString()
            : null,
          revokedAt: null,
          revokeReason: null,
          contentHash: generateContentHash(certNo),
          pdfKey: `certs/${new Date().getFullYear()}/${certNo.toLowerCase()}.pdf`,
        };
        certificates.unshift(cert);
        recordChange("certificate");
        return cert;
      });
    },
    async revoke(id: string, reason: string, notes: string) {
      return withLatency(() => {
        const idx = certificates.findIndex((c) => c.id === id);
        if (idx < 0) return null;
        const cert = certificates[idx]!;
        cert.status = "REVOKED" as CertificateStatus;
        cert.revokedAt = new Date().toISOString();
        cert.revokeReason = notes ? `${reason} — ${notes}` : reason;
        certificates[idx] = cert;
        recordChange("certificate");
        return cert;
      });
    },
  },

  /* ── Payments ──────────────────────────────────────────────── */
  payments: {
    async list(
      filters: PaymentFilters = {},
      scopeCourseIds?: string[],
    ): Promise<Paginated<Payment>> {
      return withLatency(() => {
        let rows = payments.slice();
        if (scopeCourseIds && scopeCourseIds.length > 0) {
          rows = rows.filter((p) => scopeCourseIds.includes(p.courseId));
        }
        if (filters.search) {
          const q = filters.search.toLowerCase();
          rows = rows.filter((p) => {
            const name = traineeById.get(p.traineeId)?.name.toLowerCase() ?? "";
            return p.receiptNo.toLowerCase().includes(q) || name.includes(q);
          });
        }
        if (filters.courseIds?.length) rows = rows.filter((p) => filters.courseIds!.includes(p.courseId));
        if (filters.statuses?.length) rows = rows.filter((p) => filters.statuses!.includes(p.status));
        if (filters.methods?.length) rows = rows.filter((p) => filters.methods!.includes(p.method));
        if (filters.trainerIds?.length) rows = rows.filter((p) => filters.trainerIds!.includes(p.trainerId));
        if (filters.from || filters.to) rows = rows.filter((p) => inRange(p.paidAt, filters.from, filters.to));
        rows = sortRows(rows, filters.sort, {
          trainee: (p) => traineeById.get(p.traineeId)?.name ?? "",
          amountRwf: (p) => p.amountRwf,
          paidAt: (p) => p.paidAt,
          status: (p) => p.status,
          method: (p) => p.method,
        });
        return paginate(rows, filters.page, filters.pageSize);
      });
    },
    async get(id: string): Promise<Payment | null> {
      return withLatency(() => payments.find((p) => p.id === id) ?? null);
    },
    async create(input: {
      traineeId: string;
      courseId: string;
      amountRwf: number;
      method: Payment["method"];
      reference: string;
      notes: string;
    }): Promise<Payment> {
      return withLatency(() => {
        const trainee = traineeById.get(input.traineeId);
        const course = courses.find((c) => c.id === input.courseId) ?? courses[0]!;
        const price = trainee?.totalDueRwf ?? course.priceRwf;
        const payment: Payment = {
          id: `pay_${String(payments.length + 1).padStart(3, "0")}`,
          receiptNo: generateReceiptNo(new Date().getFullYear(), payments.length + 1),
          traineeId: input.traineeId,
          courseId: input.courseId,
          amountRwf: input.amountRwf,
          method: input.method,
          status: input.amountRwf >= price ? "PAID" : input.amountRwf > 0 ? "PARTIAL" : "UNPAID",
          paidAt: new Date().toISOString(),
          recordedById: "usr_admin",
          trainerId: course.trainerId,
          reference: input.reference || "—",
          notes: input.notes,
        };
        payments.unshift(payment);
        const idx = trainees.findIndex((t) => t.id === input.traineeId);
        if (idx >= 0) {
          const t = trainees[idx]!;
          t.amountPaidRwf = Math.min(price, t.amountPaidRwf + input.amountRwf);
          t.paymentStatus =
            t.amountPaidRwf >= price ? "PAID" : t.amountPaidRwf > 0 ? "PARTIAL" : "UNPAID";
          t.updatedAt = new Date().toISOString();
        }
        recordChange("payment");
        return payment;
      });
    },
    async refund(id: string): Promise<Payment | null> {
      return withLatency(() => {
        const payment = payments.find((p) => p.id === id);
        if (!payment) return null;
        payment.amountRwf = -Math.round(payment.amountRwf / 2);
        payment.status = "PARTIAL";
        payment.notes = `Refund issued — ${payment.notes}`.trim();
        recordChange("payment");
        return payment;
      });
    },
    async summary() {
      return withLatency(() => {
        const thisMonth = payments.filter(
          (p) => p.status === "PAID" && p.paidAt >= new Date(MOCK_NOW.getFullYear(), MOCK_NOW.getMonth(), 1).toISOString(),
        );
        const collected = thisMonth.reduce((s, p) => s + p.amountRwf, 0);
        const outstanding = trainees.reduce((s, t) => s + Math.max(0, t.totalDueRwf - t.amountPaidRwf), 0);
        const refunds = payments.filter((p) => p.amountRwf < 0).reduce((s, p) => s + Math.abs(p.amountRwf), 0);
        return {
          collectedThisMonth: collected,
          outstanding,
          refunds,
          lastMonth: Math.round(collected * 0.82),
          invoiceCount: thisMonth.length,
        };
      });
    },
    recorderNames,
  },

  /* ── Notifications ─────────────────────────────────────────── */
  /* Removed: the notification list is served by /api/notifications and hydrated
   * into the zustand store. Nothing reads `mockApi.notifications` any more. */

  /* ── Audit log ─────────────────────────────────────────────── */
  audit: {
    async list(filters: AuditFilters = {}): Promise<Paginated<AuditEntry>> {
      return withLatency(() => {
        let rows = auditEntries.slice();
        if (filters.search) {
          const q = filters.search.toLowerCase();
          rows = rows.filter(
            (a) =>
              a.entityLabel.toLowerCase().includes(q) ||
              a.action.toLowerCase().includes(q) ||
              a.actorName.toLowerCase().includes(q),
          );
        }
        if (filters.actors?.length) rows = rows.filter((a) => filters.actors!.includes(a.actorId));
        if (filters.actions?.length) rows = rows.filter((a) => filters.actions!.includes(a.action));
        if (filters.entityTypes?.length) rows = rows.filter((a) => filters.entityTypes!.includes(a.entityType));
        if (filters.from || filters.to) rows = rows.filter((a) => inRange(a.at, filters.from, filters.to));
        rows = sortRows(rows, filters.sort, {
          at: (a) => a.at,
          actor: (a) => a.actorName,
          action: (a) => a.action,
          entity: (a) => a.entityLabel,
        });
        return paginate(rows, filters.page, filters.pageSize);
      });
    },
    async forEntity(entityType: string, entityId: string): Promise<AuditEntry[]> {
      return withLatency(() =>
        auditEntries.filter((a) => a.entityType === entityType && a.entityId === entityId),
      );
    },
    async forTrainee(traineeId: string): Promise<AuditEntry[]> {
      return withLatency(() =>
        auditEntries.filter(
          (a) =>
            (a.entityType === "trainee" && a.entityId === traineeId) ||
            a.after?.traineeId === traineeId ||
            (a.entityType === "payment" &&
              payments.some(
                (p) => p.id === a.entityId && p.traineeId === traineeId,
              )) ||
            (a.entityType === "certificate" &&
              certificates.some(
                (c) => c.id === a.entityId && c.traineeId === traineeId,
              )),
        ),
      );
    },
  },

  /* ── Dashboard ─────────────────────────────────────────────── */
  dashboard: {
    async get(trainerId?: string): Promise<DashboardData> {
      return withLatency(() => buildDashboard(trainerId));
    },
  },

  /* ── Settings + sessions ───────────────────────────────────── */
  settings: {
    async get(): Promise<AcademySettings> {
      return withLatency(() => ({ ...settings, notificationMatrix: { ...settings.notificationMatrix } }));
    },
    async update(input: Partial<AcademySettings>): Promise<AcademySettings> {
      return withLatency(() => {
        settings = { ...settings, ...input };
        return { ...settings };
      });
    },
  },
  sessions: {
    async list(): Promise<Session[]> {
      return withLatency(() => sessions.slice());
    },
    async revoke(id: string): Promise<Session[]> {
      return withLatency(() => sessions.filter((s) => s.id !== id));
    },
  },

  /* ── Reports ───────────────────────────────────────────────── */
  reports: {
    definitions: reportDefinitions,
    async estimate(type: ReportType, filters: { courseIds?: string[]; from?: string; to?: string }): Promise<{ rows: number; label: string }> {
      return withLatency(() => {
        const inScope = (rows: { courseId: string }[]) =>
          filters.courseIds?.length ? rows.filter((r) => filters.courseIds!.includes(r.courseId)) : rows;
        let rows = 0;
        let label = "rows";
        switch (type) {
          case "trainee-roster":
            rows = inScope(trainees).length;
            label = "trainees";
            break;
          case "attendance-sheet":
            rows = inScope(trainees).length;
            label = "attendance rows";
            break;
          case "exam-results":
            rows = inScope(attempts).length;
            label = "attempts";
            break;
          case "certificate-register":
            rows = inScope(certificates).length;
            label = "certificates";
            break;
          case "payment-ledger":
            rows = inScope(payments).length;
            label = "payments";
            break;
          case "trainer-activity":
            rows = trainers.length;
            label = "trainers";
            break;
          case "revenue-summary":
            rows = courses.length;
            label = "courses";
            break;
        }
        if (filters.from || filters.to) rows = Math.round(rows * 0.62);
        return { rows, label };
      });
    },
    async generate(input: {
      type: ReportType;
      format: ReportFormat;
      includeHeader: boolean;
      includeFooter: boolean;
    }) {
      await sleep(2_800);
      const def = reportDefinitions.find((d) => d.type === input.type);
      return {
        id: `rpt_${Date.now().toString(36)}`,
        fileName: `${(def?.title ?? "report").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.${input.format}`,
        sizeKb: 180 + Math.round(Math.random() * 900),
        generatedAt: new Date().toISOString(),
        format: input.format,
      };
    },
  },

  /* ── CSV import ────────────────────────────────────────────── */
  import: {
    async parseCsv(text: string) {
      return withLatency(() => {
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        if (lines.length === 0) return { headers: [] as string[], rows: [] as string[][] };
        const split = (line: string): string[] => {
          const cells: string[] = [];
          let cur = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i += 1;
              } else inQuotes = !inQuotes;
            } else if (ch === "," && !inQuotes) {
              cells.push(cur);
              cur = "";
            } else cur += ch;
          }
          cells.push(cur);
          return cells.map((c) => c.trim());
        };
        return { headers: split(lines[0] as string), rows: lines.slice(1).map(split) };
      });
    },
    async validate(rows: Record<string, string>[]) {
      return withLatency(() => {
        const result = rows.map((values, i) => {
          const errors: string[] = [];
          const email = values.email ?? "";
          const name = values.name ?? "";
          const courseCode = (values.course ?? values.courseCode ?? "").toUpperCase();
          const course = courses.find((c) => c.code === courseCode);
          if (!name) errors.push("Missing full name");
          else if (name.length < 3) errors.push("Name is too short");
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`"${email || "(blank)"}" is not a valid email`);
          if (!course) errors.push(`Unknown course code "${courseCode || "(blank)"}"`);
          const amount = Number(values.amountPaid ?? values.amount ?? 0);
          if (Number.isNaN(amount)) errors.push("Amount paid must be a number");
          if (values.phone && !/^\+?\d[\d\s]{6,}$/.test(values.phone)) {
            errors.push(`"${values.phone}" is not a valid phone number`);
          }
          return { rowNumber: i + 2, values, errors, status: errors.length === 0 ? ("valid" as const) : ("error" as const) };
        });
        return result;
      });
    },
  },
};

/* ── Convenience exports ───────────────────────────────────────── */

export { courses, trainers, questions, trainees, exams, attempts, certificates, payments, auditEntries, MOCK_NOW };
export { reportDefinitions } from "./courses";
export { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITY_TYPES } from "./audit-log";
export { balanceFor } from "./payments";
export { questionsByCourse } from "./questions";
export { traineeById } from "./trainees";
export { examById, examByCourseId } from "./exams";
export { attemptById, attemptByToken, questionsForAttempt } from "./attempts";
export { certificateById, certificateByToken } from "./certificates";
