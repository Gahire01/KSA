import { z } from "zod";

import { MAX_PAGE_SIZE } from "@/lib/api/schemas";

/** Largest single amount accepted: 100 million RWF, far above any fee. */
const MAX_AMOUNT = 100_000_000;

export const PAYMENT_METHODS = ["CASH", "MOMO", "BANK", "CARD"] as const;

/**
 * Recording a payment. The amount arrives as a whole number of francs and is never
 * zero; an empty field is the form's problem (it saves 0 as "nothing to record"), not
 * something the API guesses at.
 */
export const paymentCreateSchema = z
  .object({
    traineeId: z.string().trim().min(1, "Choose a trainee.").max(64),
    amountRwf: z.coerce
      .number({ message: "Enter an amount." })
      .int("Enter whole francs.")
      .min(1, "Enter an amount above zero.")
      .max(MAX_AMOUNT, "That amount is too large."),
    method: z.enum(PAYMENT_METHODS, { message: "Choose how it was paid." }),
    reference: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    paidAt: z.coerce.date().optional(),
  })
  .strict();

export const refundSchema = z
  .object({
    reason: z.string().trim().min(3, "Say why it is being refunded.").max(500),
  })
  .strict();

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

export const paymentListQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    courseIds: csv(z.string().trim().min(1)),
    methods: csv(z.enum(PAYMENT_METHODS)),
    statuses: csv(z.enum(["PAID", "PARTIAL", "UNPAID"])),
    traineeId: z.string().trim().min(1).max(64).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
  })
  .strict();
