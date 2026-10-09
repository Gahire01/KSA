/* ═══════════════════════════════════════════════════════════════════
   Kigali Safety Academy — view-model types the pages render.
   The database is the source of truth; lib/api/adapters.ts turns API
   responses into these shapes.
   ═══════════════════════════════════════════════════════════════════ */

/** A category's name, as stored (the academy edits categories in the database). */
export type Category = string;

export const COUNTRIES = [
  "Rwanda",
  "Uganda",
  "Kenya",
  "Tanzania",
  "Burundi",
  "DRC",
] as const;
export type Country = (typeof COUNTRIES)[number];

export type Role = "OWNER" | "ADMIN" | "TRAINER";

export type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";

export type EnrollmentStatus = "ACTIVE" | "PENDING" | "COMPLETED" | "FAILED" | "WITHDRAWN";

/** A certificate is valid until revoked. It never expires. */
export type CertificateStatus = "VALID" | "REVOKED";

export type DurationUnit = "day" | "week" | "month";

export type NotificationType =
  | "exam.sent"
  | "exam.submitted"
  | "exam.passed"
  | "exam.failed"
  | "payment.recorded"
  | "trainee.enrolled"
  | "deadline.approaching"
  | "certificate.issued"
  | "certificate.revoked"
  | "exam.link.expiring"
  | "system";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  trainerId?: string;
  avatarUrl?: string;
  title?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  category: Category;
  description: string;
  durationValue: number;
  durationUnit: DurationUnit;
  /** The standard price. */
  priceRwf: number;
  /** Every package on offer; empty when only the standard price is set. */
  priceTiers: Array<{ label: string; amountRwf: number }>;
  passMarkPct: number;
  maxAttempts: number;
  validityMonths: number | null;
  examDurationMin: number;
  trainerId: string;
  questionCount: number;
  isActive: boolean;
  enrolledCount: number;
  createdAt: string;
}

export interface Trainee {
  id: string;
  traineeNo: string;
  name: string;
  email: string;
  phone: string;
  country: Country;
  category: Category;
  status: EnrollmentStatus;
  paymentStatus: PaymentStatus;
  amountPaidRwf: number;
  totalDueRwf: number;
  courseId: string;
  enrolledAt: string;
  deadline: string;
  examScore: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  mention: boolean;
  link: string | null;
  actorName: string;
}
