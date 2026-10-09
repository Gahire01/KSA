import { z } from "zod";

/**
 * Course pricing. A course offers one or more packages ("tiers"); `Course.priceRwf` is
 * the STANDARD price: the package labelled "Standard" if there is one, otherwise the
 * middle one of three (lower-middle for an even count), or simply the only one.
 *
 * Pure and dependency-free so the course form, the API and the payments ledger all
 * apply exactly the same rule.
 */

export interface PriceTier {
  label: string;
  amountRwf: number;
}

export const MAX_PRICE_TIERS = 6;

export const priceTierSchema = z
  .object({
    label: z.string().trim().min(1, "Name every package.").max(40, "Keep package names short."),
    amountRwf: z.coerce
      .number({ message: "Enter an amount." })
      .int("Use whole francs.")
      .min(0, "Amount cannot be negative.")
      .max(100_000_000),
  })
  .strict();

export const priceTiersSchema = z
  .array(priceTierSchema)
  .min(1, "Add at least one price.")
  .max(MAX_PRICE_TIERS, `At most ${MAX_PRICE_TIERS} packages.`)
  .refine((tiers) => new Set(tiers.map((t) => t.label.toLowerCase())).size === tiers.length, {
    message: "Each package needs a different name.",
  });

/** Reads the JSON column defensively: anything malformed counts as "no tiers". */
export function parseTiers(raw: unknown): PriceTier[] {
  const parsed = priceTiersSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** The standard price for a list of tiers (0 when there are none). */
export function standardPrice(tiers: readonly PriceTier[]): number {
  if (tiers.length === 0) return 0;
  const named = tiers.find((t) => t.label.trim().toLowerCase() === "standard");
  if (named) return named.amountRwf;
  return (tiers[Math.ceil(tiers.length / 2) - 1] as PriceTier).amountRwf;
}

/**
 * The amount at which a trainee counts as paid in full: the cheapest package. Someone who
 * paid for Basic has bought Basic, not part of Comprehensive.
 */
export function settlementPrice(course: { priceRwf: number; priceTiers?: unknown } | null): number {
  if (!course) return 0;
  const tiers = parseTiers(course.priceTiers);
  return tiers.length > 0 ? Math.min(...tiers.map((t) => t.amountRwf)) : course.priceRwf;
}
