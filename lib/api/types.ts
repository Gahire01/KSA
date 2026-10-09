export type Role = "OWNER" | "ADMIN" | "TRAINER";
export type EnrollmentStatus = "PENDING" | "ACTIVE" | "COMPLETED" | "FAILED" | "WITHDRAWN";
export type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";
export type DurationUnit = "DAY" | "WEEK" | "MONTH";

export interface PriceTierDTO {
  label: string;
  amountRwf: number;
}

export interface CategoryDTO {
  id: string;
  name: string;
}

export interface CategoryWithCountDTO extends CategoryDTO {
  courseCount: number;
}

export interface CourseDTO {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  category: CategoryDTO;
  description: string | null;
  topics: string[];
  durationValue: number;
  durationUnit: DurationUnit;
  priceRwf: number;
  priceTiers?: PriceTierDTO[] | null;
  passMarkPct: number;
  maxAttempts: number;
  validityMonths: number | null;
  examDurationMin: number;
  /** Loose string until the Trainer model lands in Phase 2. */
  trainerId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { trainees: number };
}

export interface TraineeCourseRef {
  id: string;
  code: string;
  name: string;
  priceRwf: number;
}

export interface TraineeDTO {
  id: string;
  traineeNo: string;
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  categoryId: string;
  category?: CategoryDTO;
  courseId: string | null;
  course?: TraineeCourseRef | null;
  enrolledAt: string;
  deadlineAt: string | null;
  status: EnrollmentStatus;
  paymentStatus: PaymentStatus;
  amountPaidRwf: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MeDTO {
  id: string;
  email: string;
  role: Role;
  name: string;
}

export interface LoginResultDTO {
  /** Echoed back so the code screen can show where the code was sent. */
  email: string;
  nextStep: "email-otp";
}

export interface LoginVerifyDTO {
  role: Role;
  email: string;
  name: string;
}

export interface LoginResendDTO {
  sent: boolean;
}

export interface MfaSetupDTO {
  otpauthUrl: string;
  qrDataUrl: string;
  issuer: string;
  email: string;
}

export interface MfaConfirmDTO {
  recoveryCodes: string[];
}

export interface MfaVerifyDTO {
  verified: boolean;
  via?: "totp" | "recovery" | "session";
  recoveryCodesRemaining?: number;
}

/* ── Input payloads ──────────────────────────────────────────── */

export interface TraineeInput {
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  categoryId: string;
  courseId?: string | null;
  deadlineAt?: string | null;
  status?: EnrollmentStatus;
  paymentStatus?: PaymentStatus;
  amountPaidRwf?: number;
  notes?: string | null;
}

export interface CourseInput {
  code: string;
  name: string;
  categoryId: string;
  description?: string | null;
  topics?: string[];
  durationValue: number;
  durationUnit: DurationUnit;
  priceRwf: number;
  priceTiers?: PriceTierDTO[] | null;
  passMarkPct?: number;
  maxAttempts?: number;
  validityMonths?: number | null;
  examDurationMin?: number;
  isActive?: boolean;
}

/**
 * Filters serialise to comma-separated query values, so any multi-select in
 * the UI maps straight onto these array fields. Empty arrays mean "no filter".
 */
export interface TraineeFilters {
  search?: string;
  status?: EnrollmentStatus[];
  paymentStatus?: PaymentStatus[];
  courseId?: string[];
  categoryId?: string[];
  country?: string[];
  enrolledFrom?: string;
  enrolledTo?: string;
  page?: number;
  pageSize?: number;
}

export interface CourseFilters {
  search?: string;
  categoryId?: string[];
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}
