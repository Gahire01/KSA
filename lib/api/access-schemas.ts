import { z } from "zod";

import { ACCESS_LINK_MAX_DAYS } from "@/lib/auth/access-links";

/**
 * Access-link and device request schemas.
 *
 * `.strict()` throughout: an unknown key is a 422 rather than being dropped, so a
 * client typo like `single_use` fails loudly instead of silently minting a
 * multi-use link when the caller meant single-use.
 */

export const accessLinkCreateSchema = z
  .object({
    /* Links can only be minted for the roles below OWNER. An owner handing out an
     * owner link is handing out the whole system, so it has to be a deliberate,
     * named choice rather than a default in a dropdown. */
    role: z.enum(["ADMIN", "TRAINER"]),
    trainerId: z.string().trim().min(1).max(60).nullish(),
    label: z.string().trim().max(120).nullish(),
    expiresInDays: z.coerce
      .number()
      .int()
      .min(1)
      .max(ACCESS_LINK_MAX_DAYS)
      .optional(),
    singleUse: z.boolean().default(false),
  })
  .strict()
  .refine(
    (v) => v.role !== "TRAINER" || Boolean(v.trainerId),
    { message: "A trainer link must name the trainer it is for.", path: ["trainerId"] },
  );

export const referralCodeCreateSchema = z
  .object({
    role: z.enum(["ADMIN", "TRAINER"]),
    trainerId: z.string().trim().min(1).max(60).nullish(),
    maxUses: z.coerce.number().int().min(1).max(500).default(1),
    expiresInDays: z.coerce.number().int().min(1).max(365).default(60),
  })
  .strict()
  .refine((v) => v.role !== "TRAINER" || Boolean(v.trainerId), {
    message: "A trainer code must name the trainer it is for.",
    path: ["trainerId"],
  });

/**
 * Redeeming a link is the highest-value unauthenticated action in the product, so it
 * takes the token in the body rather than the URL. A token in a path lands in
 * `Referer` headers, proxy logs and browser history; in a POST body it does not.
 */
export const redeemAccessLinkSchema = z
  .object({
    token: z.string().trim().min(20).max(200),
    email: z.string().trim().email().max(200),
    password: z.string().min(12).max(200),
    fullName: z.string().trim().min(2).max(120),
  })
  .strict();

export const deviceRevokeSchema = z
  .object({
    /** Revoke every device except the one making this request. */
    everywhere: z.boolean().default(false),
  })
  .strict();
