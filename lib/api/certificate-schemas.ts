import { z } from "zod";

/**
 * Certificate request schemas.
 *
 * Kept apart from `lib/api/schemas.ts` because these back the Step 10 routes, and
 * like every other POST/PATCH body here the object is `.strict()`, so an unknown
 * key is a 422 rather than being silently dropped.
 */

const STATUSES = ["VALID", "REVOKED"] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

/** Comma-separated query lists, matching the multi-select chips. */
const csv = z
  .string()
  .trim()
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50),
  );

export const certificateListQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    status: csv.optional().transform((v) =>
      v
        ? v
            .map((s) => s.toUpperCase())
            .filter((s): s is (typeof STATUSES)[number] =>
              (STATUSES as readonly string[]).includes(s),
            )
        : undefined,
    ),
    courseIds: csv.optional(),
    issuedFrom: isoDate.optional(),
    issuedTo: isoDate.optional(),
    /* Query strings are always text, so these are coerced before the bounds check.
     * `.default` (not `.catch`) means a bad page number is a 422 rather than being
     * quietly rewritten to page 1 behind the caller's back. */
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const revokeCertificateSchema = z
  .object({
    /* Employers read this, so the reason is required and is shown publicly. */
    reason: z
      .string()
      .trim()
      .min(8, "Give a reason of at least 8 characters.")
      .max(500, "Keep the reason under 500 characters."),
  })
  .strict();
