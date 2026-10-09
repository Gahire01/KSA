import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Report data: one builder per report, each returning plain rows plus a summary of
 * the filters used, so the Excel and PDF writers print exactly the same thing.
 * Everything is read from the database; nothing is sampled or invented.
 */

export const REPORT_TYPES = [
  "trainee-roster",
  "payments",
  "exam-results",
  "certificate-register",
  "audit-log",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_META: Record<ReportType, { title: string; description: string; ownerOnly?: boolean }> = {
  "trainee-roster": { title: "Trainee roster", description: "Everyone enrolled, with course, status and fees paid." },
  payments: { title: "Payments", description: "Every receipt and refund, with method and who recorded it." },
  "exam-results": { title: "Exam results", description: "Every sitting: score, outcome and times the window was left." },
  "certificate-register": { title: "Certificate register", description: "Every certificate issued, valid or revoked." },
  "audit-log": { title: "Audit log", description: "The append-only record of privileged actions.", ownerOnly: true },
};

export interface ReportFilters {
  courseIds?: string[];
  methods?: string[];
  statuses?: string[];
  from?: Date;
  to?: Date;
}

export interface ReportTable {
  title: string;
  /** Human lines describing the filters, e.g. "Course: First Aid". */
  filterSummary: string[];
  columns: Array<{ header: string; width: number; align?: "left" | "right" }>;
  rows: Array<Array<string | number>>;
}

const dateOnly = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const dateTime = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");
const endOfDay = (d: Date) => new Date(d.getTime() + 86_399_999);

async function courseNames(ids: string[] | undefined): Promise<string | null> {
  if (!ids?.length) return null;
  const rows = await prisma.course.findMany({ where: { id: { in: ids } }, select: { name: true } });
  return rows.map((r) => r.name).join(", ");
}

async function summaryOf(filters: ReportFilters, extra: Array<[string, string | undefined]> = []): Promise<string[]> {
  const lines: string[] = [];
  const courses = await courseNames(filters.courseIds);
  if (courses) lines.push(`Course: ${courses}`);
  for (const [label, value] of extra) if (value) lines.push(`${label}: ${value}`);
  if (filters.from || filters.to) lines.push(`Dates: ${dateOnly(filters.from) || "…"} to ${dateOnly(filters.to) || "…"}`);
  return lines.length ? lines : ["No filters: everything"];
}

function range(field: string, filters: ReportFilters) {
  if (!filters.from && !filters.to) return {};
  return {
    [field]: {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: endOfDay(filters.to) } : {}),
    },
  };
}

async function traineeRoster(filters: ReportFilters): Promise<ReportTable> {
  const where: Prisma.TraineeWhereInput = {
    ...(filters.courseIds?.length ? { courseId: { in: filters.courseIds } } : {}),
    ...(filters.statuses?.length ? { status: { in: filters.statuses as Array<"ACTIVE"> } } : {}),
    ...range("enrolledAt", filters),
  };
  const rows = await prisma.trainee.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      traineeNo: true,
      fullName: true,
      email: true,
      phone: true,
      countryCode: true,
      category: { select: { name: true } },
      course: { select: { name: true } },
      status: true,
      paymentStatus: true,
      amountPaidRwf: true,
      enrolledAt: true,
      deadlineAt: true,
    },
  });
  return {
    title: REPORT_META["trainee-roster"].title,
    filterSummary: await summaryOf(filters, [["Status", filters.statuses?.join(", ")]]),
    columns: [
      { header: "No.", width: 8 },
      { header: "Name", width: 26 },
      { header: "Email", width: 30 },
      { header: "Phone", width: 16 },
      { header: "Country", width: 12 },
      { header: "Category", width: 18 },
      { header: "Course", width: 30 },
      { header: "Status", width: 12 },
      { header: "Payment", width: 10 },
      { header: "Paid (RWF)", width: 12, align: "right" },
      { header: "Enrolled", width: 12 },
      { header: "Deadline", width: 12 },
    ],
    rows: rows.map((t) => [
      t.traineeNo,
      t.fullName,
      t.email,
      t.phone,
      t.countryCode,
      t.category.name,
      t.course?.name ?? "",
      t.status,
      t.paymentStatus,
      t.amountPaidRwf,
      dateOnly(t.enrolledAt),
      dateOnly(t.deadlineAt),
    ]),
  };
}

async function payments(filters: ReportFilters): Promise<ReportTable> {
  const where: Prisma.PaymentWhereInput = {
    ...(filters.courseIds?.length ? { courseId: { in: filters.courseIds } } : {}),
    ...(filters.methods?.length ? { method: { in: filters.methods as Array<"CASH"> } } : {}),
    ...range("paidAt", filters),
  };
  const rows = await prisma.payment.findMany({
    where,
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    select: {
      receiptNo: true,
      paidAt: true,
      trainee: { select: { fullName: true, traineeNo: true } },
      course: { select: { name: true } },
      method: true,
      amountRwf: true,
      reference: true,
      recordedByName: true,
      notes: true,
    },
  });
  return {
    title: REPORT_META.payments.title,
    filterSummary: await summaryOf(filters, [["Method", filters.methods?.join(", ")]]),
    columns: [
      { header: "Receipt", width: 23 },
      { header: "Date", width: 12 },
      { header: "Trainee", width: 26 },
      { header: "No.", width: 8 },
      { header: "Course", width: 28 },
      { header: "Method", width: 10 },
      { header: "Amount (RWF)", width: 14, align: "right" },
      { header: "Reference", width: 20 },
      { header: "Recorded by", width: 20 },
      { header: "Notes", width: 28 },
    ],
    rows: rows.map((p) => [
      p.receiptNo,
      dateOnly(p.paidAt),
      p.trainee.fullName,
      p.trainee.traineeNo,
      p.course?.name ?? "",
      p.method,
      p.amountRwf,
      p.reference ?? "",
      p.recordedByName ?? "",
      p.notes ?? "",
    ]),
  };
}

async function examResults(filters: ReportFilters): Promise<ReportTable> {
  const where: Prisma.ExamAttemptWhereInput = {
    status: { in: ["SUBMITTED", "PASSED", "FAILED"] },
    ...(filters.courseIds?.length ? { courseId: { in: filters.courseIds } } : {}),
    ...range("submittedAt", filters),
  };
  const rows = await prisma.examAttempt.findMany({
    where,
    orderBy: { submittedAt: "asc" },
    select: {
      trainee: { select: { fullName: true, traineeNo: true } },
      course: { select: { name: true } },
      attemptNumber: true,
      status: true,
      scorePct: true,
      correctCount: true,
      totalCount: true,
      startedAt: true,
      submittedAt: true,
      blurCount: true,
    },
  });
  return {
    title: REPORT_META["exam-results"].title,
    filterSummary: await summaryOf(filters),
    columns: [
      { header: "Trainee", width: 26 },
      { header: "No.", width: 8 },
      { header: "Course", width: 30 },
      { header: "Attempt", width: 8 },
      { header: "Outcome", width: 12 },
      { header: "Score %", width: 9, align: "right" },
      { header: "Correct", width: 10, align: "right" },
      { header: "Started", width: 17 },
      { header: "Submitted", width: 17 },
      { header: "Window left", width: 11, align: "right" },
    ],
    rows: rows.map((a) => [
      a.trainee.fullName,
      a.trainee.traineeNo,
      a.course.name,
      a.attemptNumber,
      a.status === "PASSED" ? "Passed" : "Not passed",
      a.scorePct ?? "",
      a.totalCount === null ? "" : `${a.correctCount ?? 0}/${a.totalCount}`,
      dateTime(a.startedAt),
      dateTime(a.submittedAt),
      a.blurCount,
    ]),
  };
}

async function certificateRegister(filters: ReportFilters): Promise<ReportTable> {
  const where: Prisma.CertificateWhereInput = {
    ...(filters.courseIds?.length ? { courseId: { in: filters.courseIds } } : {}),
    ...range("issuedAt", filters),
  };
  const rows = await prisma.certificate.findMany({
    where,
    orderBy: { studentNumber: "asc" },
    select: {
      studentNumber: true,
      trainee: { select: { fullName: true } },
      course: { select: { name: true } },
      durationSnapshot: true,
      issuedAt: true,
      revokedAt: true,
      revokedReason: true,
      contentHash: true,
    },
  });
  return {
    title: REPORT_META["certificate-register"].title,
    filterSummary: await summaryOf(filters),
    columns: [
      { header: "Student no.", width: 11 },
      { header: "Trainee", width: 28 },
      { header: "Course", width: 32 },
      { header: "Duration", width: 12 },
      { header: "Issued", width: 12 },
      { header: "Status", width: 10 },
      { header: "Revocation reason", width: 30 },
      { header: "Content hash", width: 22 },
    ],
    rows: rows.map((c) => [
      c.studentNumber,
      c.trainee.fullName,
      c.course.name,
      c.durationSnapshot,
      dateOnly(c.issuedAt),
      c.revokedAt ? "Revoked" : "Valid",
      c.revokedReason ?? "",
      c.contentHash.slice(0, 16),
    ]),
  };
}

async function auditLog(filters: ReportFilters): Promise<ReportTable> {
  const rows = await prisma.auditLog.findMany({
    where: range("createdAt", filters),
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, actorEmail: true, action: true, entityType: true, entityId: true, ip: true, meta: true },
  });
  return {
    title: REPORT_META["audit-log"].title,
    filterSummary: await summaryOf({ from: filters.from, to: filters.to }),
    columns: [
      { header: "When", width: 17 },
      { header: "Actor", width: 28 },
      { header: "Action", width: 26 },
      { header: "Record", width: 30 },
      { header: "IP", width: 16 },
      { header: "Details", width: 40 },
    ],
    rows: rows.map((a) => [
      dateTime(a.createdAt),
      a.actorEmail ?? "Trainee / system",
      a.action,
      [a.entityType, a.entityId].filter(Boolean).join(" · "),
      a.ip ?? "",
      a.meta ?? "",
    ]),
  };
}

export async function buildReport(type: ReportType, filters: ReportFilters): Promise<ReportTable> {
  switch (type) {
    case "trainee-roster":
      return traineeRoster(filters);
    case "payments":
      return payments(filters);
    case "exam-results":
      return examResults(filters);
    case "certificate-register":
      return certificateRegister(filters);
    case "audit-log":
      return auditLog(filters);
  }
}
