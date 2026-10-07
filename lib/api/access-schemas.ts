import { z } from "zod";

import {
  ACCESS_LINK_MAX_DEVICES,
  ACCESS_LINK_MAX_HOURS,
} from "@/lib/auth/access-links";

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
    label: z.string().trim().min(1, "Give the link a label so you recognise it later.").max(120),
    /** Hours until the link stops working. Default 24, max 720 (30 days). */
    expiresInHours: z.coerce.number().int().min(1).max(ACCESS_LINK_MAX_HOURS).optional(),
    singleUse: z.boolean().default(false),
    /** Devices that may be signed in through this link, 1 to 5 (default 5). */
    maxDevices: z.coerce.number().int().min(1).max(ACCESS_LINK_MAX_DEVICES).optional(),
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
 *
 * There is nothing else to send: team members have no email or password. The link
 * itself is the credential.
 */
export const redeemAccessLinkSchema = z
  .object({
    token: z.string().trim().min(20).max(200),
  })
  .strict();

/** A referral code typed on the sign-in page. */
export const redeemReferralSchema = z
  .object({
    code: z.string().trim().min(4).max(32),
  })
  .strict();

export const deviceRevokeSchema = z
  .object({
    /** Revoke every device except the one making this request. */
    everywhere: z.boolean().default(false),
  })
  .strict();
