import { z } from "zod";

/**
 * Every body and query schema is `.strict()`.
 *
 * That rejects unrecognised keys outright, so a typo or a field smuggled in by a
 * future client fails loudly instead of being silently dropped by Prisma.
 */
export const loginSchema = z
  .object({
    email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email address."),
    /* Bounded so an oversized body cannot be used to burn CPU during hashing. */
    password: z.string().min(1, "Enter your password.").max(200, "Password is too long."),
  })
  .strict();

/**
 * The email sign-in code.
 *
 * Spaces are stripped before validation so a code copied as "482 913" still
 * lands, but the result must then be exactly six digits — `abc123` and a
 * five-digit stub are rejected as a 400 before any database work happens, so a
 * malformed code is never confused with a wrong one.
 */
export const loginVerifySchema = z
  .object({
    email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email address."),
    code: z
      .string()
      .transform((value) => value.replace(/\s+/g, ""))
      .pipe(z.string().regex(/^\d{6}$/, "Enter the six-digit code.")),
  })
  .strict();

export const loginResendSchema = z
  .object({
    email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email address."),
  })
  .strict();

export const totpCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/, "Enter the six-digit code from your authenticator."),
  })
  .strict();

export const recoveryCodeSchema = z
  .object({
    code: z.string().trim().min(4, "Enter a recovery code.").max(32, "That recovery code is not valid."),
  })
  .strict();

export const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Give the category a name.").max(80),
  })
  .strict();

export const courseCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Give the course a code.")
      .max(24)
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes or underscores only.")
      .transform((v) => v.toUpperCase()),
    name: z.string().trim().min(3, "Give the course a name.").max(200),
    categoryId: z.string().trim().min(1, "Choose a category."),
    description: z.string().trim().max(5000).optional().nullable(),
    topics: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
    durationValue: z.coerce.number().int().min(1, "Enter a duration.").max(999),
    durationUnit: z.enum(["DAY", "WEEK", "MONTH"]),
    priceRwf: z.coerce.number().int().min(0, "Price cannot be negative.").max(100_000_000),
    passMarkPct: z.coerce.number().int().min(1).max(100).default(50),
    maxAttempts: z.coerce.number().int().min(1).max(10).default(2),
    validityMonths: z.coerce.number().int().min(1).max(120).optional().nullable(),
    examDurationMin: z.coerce.number().int().min(1).max(600).default(30),
    trainerId: z.string().trim().min(1).max(60).optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .strict();

export const courseUpdateSchema = courseCreateSchema.partial().strict();

export const traineeCreateSchema = z
  .object({
    fullName: z.string().trim().min(3, "Enter the trainee's full name.").max(200),
    email: z.string().trim().email("Enter a valid email address.").max(160),
    phone: z
      .string()
      .trim()
      .min(7, "Enter a reachable phone number.")
      .max(32)
      /* Optional +, then digits and spaces only — no letters or extra symbols. */
      .regex(/^\+?\d[\d\s]{6,}$/, "Use digits, spaces and an optional leading +."),
    countryCode: z.string().trim().min(2, "Select a country.").max(60),
    categoryId: z.string().trim().min(1, "Choose a category."),
    courseId: z.string().trim().min(1, "Choose a course.").max(64).optional().nullable(),
    deadlineAt: z.coerce.date().optional().nullable(),
    status: z.enum(["PENDING", "ACTIVE", "COMPLETED", "FAILED", "WITHDRAWN"]).default("PENDING"),
    paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]).default("UNPAID"),
    amountPaidRwf: z.coerce.number().int().min(0).max(100_000_000).default(0),
    notes: z.string().trim().max(5000).optional().nullable(),
  })
  .strict();

export const traineeUpdateSchema = traineeCreateSchema.partial().strict();

/**
 * Comma-separated multi-value filter.
 *
 * The roster exposes multi-select filters (course, status, payment), so these
 * accept `?courseId=a,b,c` and expand to Prisma `in` clauses rather than
 * forcing the UI down to single selections.
 */
const csv = <T extends z.ZodType>(inner: T) =>
  z
    .string()
    .transform((raw) =>
      raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    )
    .pipe(z.array(inner).min(1))
    .optional();

const ENROLLMENT = ["PENDING", "ACTIVE", "COMPLETED", "FAILED", "WITHDRAWN"] as const;
const PAYMENT = ["PAID", "PARTIAL", "UNPAID"] as const;

/**
 * Ceiling on `pageSize`. The roster paginates in the browser and asks for a
 * whole page at a time, but no single request may pull an unbounded result set.
 */
export const MAX_PAGE_SIZE = 100;

export const traineeListQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    /** Aliases so the query string can match the UI's filter names. */
    status: csv(z.enum(ENROLLMENT)),
    statuses: csv(z.enum(ENROLLMENT)),
    paymentStatus: csv(z.enum(PAYMENT)),
    paymentStatuses: csv(z.enum(PAYMENT)),
    courseId: csv(z.string().trim().min(1)),
    courseIds: csv(z.string().trim().min(1)),
    categoryId: csv(z.string().trim().min(1)),
    categoryIds: csv(z.string().trim().min(1)),
    country: csv(z.string().trim().min(1)),
    countries: csv(z.string().trim().min(1)),
    enrolledFrom: z.coerce.date().optional(),
    enrolledTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    /* Hard cap: an unbounded pageSize would let one request pull the whole table. */
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  })
  .strict();

export const courseListQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    categoryId: csv(z.string().trim().min(1)),
    categoryIds: csv(z.string().trim().min(1)),
    isActive: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
export type TraineeCreateInput = z.infer<typeof traineeCreateSchema>;
export type TraineeUpdateInput = z.infer<typeof traineeUpdateSchema>;
