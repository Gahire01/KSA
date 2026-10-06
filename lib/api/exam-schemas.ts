import { z } from "zod";

/**
 * Body and query schemas for the exam, access-link, referral and notification
 * routes. Every one is `.strict()` so an unrecognised key fails loudly instead
 * of being silently dropped.
 */

/** Six digits, no spaces — the UI strips them before posting. */
export const examOtpSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/, "Enter the six-digit code we emailed you."),
  })
  .strict();

export const examSendSchema = z
  .object({
    traineeIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one trainee.").max(500),
    /** Overrides the course's own window; clamped server-side. */

    subject: z.string().trim().max(200).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

/** Autosave: the runner posts one answer at a time as the trainee moves. */
export const examAnswerSchema = z
  .object({
    questionId: z.string().trim().min(1),
    optionId: z.string().trim().min(1).nullable(),
    blurCount: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export const examSubmitSchema = z
  .object({
    blurCount: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict();

/** A locked-in access link. Hours are clamped to 1..720 (30 days). */
export const accessGenerateSchema = z
  .object({
    role: z.enum(["ADMIN", "TRAINER"]),
    trainerId: z.string().trim().min(1).max(64).optional().nullable(),
    label: z.string().trim().min(1, "Give the link a label so you recognise it later.").max(120),
    expiresInHours: z.coerce.number().int().min(1).max(720).optional(),
    singleUse: z.boolean().optional(),
  })
  .strict();

export const accessUseSchema = z
  .object({
    token: z.string().trim().min(20, "That link is not valid.").max(128),
  })
  .strict();

export const referralGenerateSchema = z
  .object({
    role: z.enum(["ADMIN", "TRAINER"]),
    trainerId: z.string().trim().min(1).max(64).optional().nullable(),
    maxUses: z.coerce.number().int().min(1).max(50).optional(),
    expiresInHours: z.coerce.number().int().min(1).max(720).optional(),
  })
  .strict();

export const referralRedeemSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(4, "Enter the code you were given.")
      .max(32),
  })
  .strict();

export const notificationListQuerySchema = z
  .object({
    unreadOnly: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();

export const questionCreateSchema = z
  .object({
    courseId: z.string().trim().min(1, "Choose a course.").max(64),
    text: z.string().trim().min(5, "Enter the question text.").max(2000),
    explanation: z.string().trim().max(2000).optional().nullable(),
    options: z
      .array(
        z
          .object({
            text: z.string().trim().min(1, "Every option needs text.").max(500),
            isCorrect: z.boolean(),
          })
          .strict(),
      )
      .min(2, "A question needs at least two options.")
      .max(8)
      .refine((opts) => opts.filter((o) => o.isCorrect).length === 1, {
        message: "Mark exactly one option as correct.",
      }),
    isActive: z.boolean().optional(),
  })
  .strict();

export const certificateRevokeSchema = z
  .object({
    reason: z.string().trim().min(3, "Give a reason so the record makes sense later.").max(500),
  })
  .strict();

export type ExamSendInput = z.infer<typeof examSendSchema>;
export type AccessGenerateInput = z.infer<typeof accessGenerateSchema>;
