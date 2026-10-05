/* ═══════════════════════════════════════════════════════════════════
   Kigali Safety Academy — domain types
   ═══════════════════════════════════════════════════════════════════ */

/* ── Enumerations ─────────────────────────────────────────────── */

/**
 * Kept for the pages that still render mock data. The seeded database rows use
 * exactly these names, so the two stay interchangeable.
 */
export const CATEGORIES = [
  "Firefighters",
  "Maintenance",
  "First Aid",
  "Site Security",
  "Electrical Safety",
  "Working at Height",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const COUNTRIES = [
  "Rwanda",
  "Uganda",
  "Kenya",
  "Tanzania",
  "Burundi",
  "DRC",
] as const;
export type Country = (typeof COUNTRIES)[number];

export const COUNTRY_DIAL_CODES: Record<Country, string> = {
  Rwanda: "+250",
  Uganda: "+256",
  Kenya: "+254",
  Tanzania: "+255",
  Burundi: "+257",
  DRC: "+243",
};

export type Role = "OWNER" | "ADMIN" | "TRAINER";

export type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";
/**
 * FAILED and WITHDRAWN are the values the database can now store; SUSPENDED is
 * retained because the Phase 2+ mock pages still reference it.
 */
export type EnrollmentStatus =
  | "ACTIVE"
  | "PENDING"
  | "COMPLETED"
  | "SUSPENDED"
  | "FAILED"
  | "WITHDRAWN";

export type PaymentMethod = "CASH" | "MOMO" | "BANK" | "CARD";

export type CertificateStatus = "VALID" | "EXPIRING" | "EXPIRED" | "REVOKED";

export type AttemptStatus =
  | "SENT"
  | "STARTED"
  | "SUBMITTED"
  | "PASSED"
  | "FAILED"
  | "VOID";

export type Difficulty = 1 | 2 | 3;

export type DurationUnit = "day" | "week" | "month";

export type ReportFormat = "pdf" | "xlsx" | "docx";

export type ReportType =
  | "trainee-roster"
  | "attendance-sheet"
  | "exam-results"
  | "certificate-register"
  | "payment-ledger"
  | "trainer-activity"
  | "revenue-summary";

export type NotificationType =
  | "exam.submitted"
  | "payment.recorded"
  | "trainee.enrolled"
  | "deadline.approaching"
  | "certificate.expiring"
  | "certificate.issued"
  | "exam.link.expiring"
  | "system";

export type NotificationChannel = "inapp" | "email" | "whatsapp";

export type AuditAction =
  | "trainee.create"
  | "trainee.update"
  | "trainee.delete"
  | "trainee.import"
  | "payment.record"
  | "payment.refund"
  | "payment.update"
  | "certificate.issue"
  | "certificate.revoke"
  | "exam.send"
  | "exam.create"
  | "exam.update"
  | "question.create"
  | "question.update"
  | "question.delete"
  | "course.create"
  | "course.update"
  | "user.login"
  | "user.logout"
  | "trainer.update"
  | "settings.update"
  | "report.generate";

/* ── Entities ─────────────────────────────────────────────────── */

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  trainerId?: string;
  avatarUrl?: string;
  title?: string;
}

export interface Trainer {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  licenseNo: string;
  bio: string;
  isDefaultSigner: boolean;
  signatureUrl: string;
  stampUrl: string;
  courseIds: string[];
  certificatesIssued: number;
  activeSince: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  category: Category;
  description: string;
  durationValue: number;
  durationUnit: DurationUnit;
  priceRwf: number;
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
  attendancePct: number;
  examScore: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  traineeId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  deadline: string;
  attendancePct: number;
  examScore: number | null;
  passedAt: string | null;
  paymentStatus: PaymentStatus;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  courseId: string;
  text: string;
  options: QuestionOption[];
  difficulty: Difficulty;
  explanation: string;
  position: number;
  timesServed: number;
  timesCorrect: number;
}

export interface Exam {
  id: string;
  courseId: string;
  title: string;
  status: "ACTIVE" | "SCHEDULED" | "COMPLETED" | "DRAFT";
  passMarkPct: number;
  maxAttempts: number;
  durationMin: number;
  questionCount: number;
  questionsToServe: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  recipientsCount: number;
  sentAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  trainerId: string;
}

export interface IntegrityFlag {
  id: string;
  type: "TAB_BLUR" | "PASTE_ATTEMPT" | "COPY_ATTEMPT" | "FULLSCREEN_EXIT" | "LATE_SUBMIT";
  at: string;
  detail: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  traineeId: string;
  courseId: string;
  token: string;
  status: AttemptStatus;
  attemptNumber: number;
  score: number | null;
  correctCount: number | null;
  questionCount: number;
  startedAt: string | null;
  submittedAt: string | null;
  durationUsedSec: number | null;
  ip: string;
  userAgent: string;
  integrityFlags: IntegrityFlag[];
  answers: Record<string, string>;
  perQuestion: AttemptAnswer[];
  voidedReason?: string;
}

export interface AttemptAnswer {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
  timeSpentSec: number;
}

export interface Certificate {
  id: string;
  certNo: string;
  verificationToken: string;
  traineeId: string;
  courseId: string;
  examId: string;
  attemptId: string;
  trainerId: string;
  status: CertificateStatus;
  score: number;
  durationLabel: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  contentHash: string;
  pdfKey: string;
}

export interface Payment {
  id: string;
  receiptNo: string;
  traineeId: string;
  courseId: string;
  amountRwf: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  recordedById: string;
  trainerId: string;
  reference: string;
  notes: string;
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

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  ip: string;
  userAgent: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AcademySettings {
  name: string;
  tagline: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  defaultSignerTrainerId: string;
  defaultPassMarkPct: number;
  currency: "RWF" | "USD";
  digestMode: "instant" | "daily";
  notificationMatrix: Record<NotificationType, Record<NotificationChannel, boolean>>;
}

export interface Session {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  lastActiveAt: string;
  current: boolean;
}

export interface ReportDefinition {
  type: ReportType;
  title: string;
  description: string;
  rowEstimate: number;
}

/* ── Query / API shapes ───────────────────────────────────────── */

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface SortSpec {
  id: string;
  desc: boolean;
}

export interface TraineeFilters {
  search?: string;
  categories?: Category[];
  courseIds?: string[];
  statuses?: EnrollmentStatus[];
  paymentStatuses?: PaymentStatus[];
  countries?: Country[];
  enrolledFrom?: string;
  enrolledTo?: string;
  trainerId?: string;
  sort?: SortSpec;
  page?: number;
  pageSize?: number;
}

export interface PaymentFilters {
  search?: string;
  courseIds?: string[];
  statuses?: PaymentStatus[];
  methods?: PaymentMethod[];
  trainerIds?: string[];
  from?: string;
  to?: string;
  sort?: SortSpec;
  page?: number;
  pageSize?: number;
}

export interface CertificateFilters {
  search?: string;
  courseIds?: string[];
  statuses?: CertificateStatus[];
  trainerIds?: string[];
  issuedFrom?: string;
  issuedTo?: string;
  sort?: SortSpec;
  page?: number;
  pageSize?: number;
}

export interface AuditFilters {
  actors?: string[];
  actions?: AuditAction[];
  entityTypes?: string[];
  from?: string;
  to?: string;
  search?: string;
  sort?: SortSpec;
  page?: number;
  pageSize?: number;
}

export interface AttemptFilters {
  statuses?: AttemptStatus[];
  flaggedOnly?: boolean;
  search?: string;
}

/* ── Dashboard aggregates ─────────────────────────────────────── */

export interface MetricPoint {
  label: string;
  value: number;
}

export interface CategoryDatum {
  category: Category;
  count: number;
}

export interface DeadlineRow {
  traineeId: string;
  traineeName: string;
  courseName: string;
  deadline: string;
  daysLeft: number;
}

export interface RevenuePoint {
  month: string;
  collectedRwf: number;
  invoiceRwf: number;
}

export interface PassRateDatum {
  courseId: string;
  courseName: string;
  passRate: number;
  attempts: number;
  averageScore: number;
}

export interface ActivityRow {
  id: string;
  actorName: string;
  action: AuditAction;
  target: string;
  at: string;
}

export interface AlertRow {
  id: string;
  severity: "info" | "warning" | "critical";
  text: string;
  at: string;
  link: string;
}

export interface DashboardData {
  metrics: {
    totalTrainees: { value: number; changePct: number };
    active: { value: number; changePct: number };
    completed: { value: number; changePct: number };
    pending: { value: number; changePct: number };
    todayAttendance: { value: number; changePct: number; spark: number[] };
  };
  categories: CategoryDatum[];
  alerts: AlertRow[];
  deadlines: DeadlineRow[];
  activity: ActivityRow[];
  revenue: RevenuePoint[];
  passRates: PassRateDatum[];
  trainerScoped: boolean;
}

export interface CsvPreviewRow {
  rowNumber: number;
  values: Record<string, string>;
  errors: string[];
  status: "valid" | "error";
}

export interface CsvFile {
  fileName: string;
  headers: string[];
  rows: string[][];
}
