/**
 * Translates API DTOs into the shapes the existing pages already render.
 *
 * This is what lets Phase 1 swap the data source without touching a single
 * page's markup: the pages keep consuming `Course` / `Trainee` from
 * `lib/types`, and only where the value came from changes.
 */
import type {
  CategoryDTO,
  CourseDTO,
  TraineeDTO,
  DurationUnit as ApiDurationUnit,
  CourseInput,
  TraineeInput,
} from "@/lib/api/types";
import { parseTiers, standardPrice } from "@/lib/courses/pricing";
import type { Category, Country, Course, DurationUnit, EnrollmentStatus, Trainee } from "@/lib/types";

/* ── DTO → view model ────────────────────────────────────────── */

export function toCourse(dto: CourseDTO): Course {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    category: (dto.category?.name ?? "") as Category,
    description: dto.description ?? "",
    durationValue: dto.durationValue,
    durationUnit: dto.durationUnit.toLowerCase() as DurationUnit,
    priceRwf: dto.priceRwf,
    priceTiers: parseTiers(dto.priceTiers),
    passMarkPct: dto.passMarkPct,
    maxAttempts: dto.maxAttempts,
    validityMonths: dto.validityMonths,
    examDurationMin: dto.examDurationMin,
    trainerId: dto.trainerId ?? "",
    questionCount: 0,
    isActive: dto.isActive,
    enrolledCount: dto._count?.trainees ?? 0,
    createdAt: dto.createdAt,
  };
}

export function toTrainee(dto: TraineeDTO): Trainee {
  return {
    id: dto.id,
    traineeNo: dto.traineeNo,
    name: dto.fullName,
    email: dto.email,
    phone: dto.phone,
    country: dto.countryCode as Country,
    category: (dto.category?.name ?? "") as Category,
    status: dto.status as EnrollmentStatus,
    paymentStatus: dto.paymentStatus,
    amountPaidRwf: dto.amountPaidRwf,
    totalDueRwf: dto.course?.priceRwf ?? 0,
    courseId: dto.courseId ?? "",
    enrolledAt: dto.enrolledAt,
    deadline: dto.deadlineAt ?? "",
    examScore: null,
    notes: dto.notes ?? "",
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function toCourses(list: CourseDTO[]): Course[] {
  return list.map(toCourse);
}

export function toTrainees(list: TraineeDTO[]): Trainee[] {
  return list.map(toTrainee);
}

/* ── form values → API input ─────────────────────────────────── */

/** The forms work in category *names*; the API keys on ids. */
function categoryIdByName(categories: CategoryDTO[], name: string): string {
  const match = categories.find(
    (c) => c.name.toLowerCase() === String(name).trim().toLowerCase(),
  );

  if (!match) {
    throw new Error(`Unknown category "${name}". Refresh the page and try again.`);
  }

  return match.id;
}

export interface TraineeFormValues {
  name: string;
  email: string;
  phone: string;
  country: string;
  category: string;
  courseId: string;
  amountPaidRwf: number;
  notes?: string;
}

export function toTraineeInput(
  values: TraineeFormValues,
  categories: CategoryDTO[],
): TraineeInput {
  return {
    fullName: values.name,
    email: values.email,
    phone: values.phone,
    countryCode: values.country,
    categoryId: categoryIdByName(categories, values.category),
    courseId: values.courseId || null,
    amountPaidRwf: values.amountPaidRwf,
    notes: values.notes ?? null,
  };
}

export interface CourseFormValues {
  code: string;
  name: string;
  category: string;
  description: string;
  durationValue: number;
  durationUnit: string;
  /** Every package; the standard price is derived from it. */
  priceTiers: Array<{ label: string; amountRwf: number }>;
  passMarkPct: number;
  maxAttempts: number;
  examDurationMin: number;
  trainerId: string;
  isActive: boolean;
}

export function toCourseInput(
  values: CourseFormValues,
  categories: CategoryDTO[],
): CourseInput & { trainerId: string | null } {
  return {
    code: values.code,
    name: values.name,
    categoryId: categoryIdByName(categories, values.category),
    description: values.description,
    durationValue: values.durationValue,
    durationUnit: values.durationUnit.toUpperCase() as ApiDurationUnit,
    priceRwf: standardPrice(values.priceTiers),
    priceTiers: values.priceTiers,
    passMarkPct: values.passMarkPct,
    maxAttempts: values.maxAttempts,
    examDurationMin: values.examDurationMin,
    isActive: values.isActive,
    trainerId: values.trainerId || null,
  };
}
