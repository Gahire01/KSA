import type { Payment, PaymentMethod, Prisma } from "@/lib/generated/prisma/client";

/**
 * The payments ledger: the one place money is recorded.
 *
 * Every payment, refund and adjustment is a `Payment` row. `Trainee.amountPaidRwf`
 * and `Trainee.paymentStatus` are the running total of those rows and are only ever
 * written here, inside the same transaction as the row that changed them, so the
 * two cannot drift. Rows are never edited or deleted: a mistake is a refund entry.
 */

import { settlementPrice } from "@/lib/courses/pricing";

type Tx = Prisma.TransactionClient;

export type PaymentStatusValue = "PAID" | "PARTIAL" | "UNPAID";

/** Who recorded it. Null for system entries. */
export interface Recorder {
  id: string;
  name: string;
}

/**
 * The amount at which a trainee counts as paid in full. Any package price will do: a
 * trainee who paid the lowest one has bought that package, not part of a bigger one.
 */
export function settlementAmount(course: { priceRwf: number; priceTiers?: unknown } | null): number {
  return settlementPrice(course);
}

export function paymentStatusFor(paidRwf: number, settlesAtRwf: number): PaymentStatusValue {
  if (paidRwf <= 0) return "UNPAID";
  return paidRwf >= settlesAtRwf ? "PAID" : "PARTIAL";
}

/** R-style receipt number for the year, one past the highest already issued. */
async function nextReceiptNo(tx: Tx, now: Date): Promise<string> {
  const prefix = `KSA-REC-${now.getFullYear()}-`;
  const last = await tx.payment.findFirst({
    where: { receiptNo: { startsWith: prefix } },
    orderBy: { receiptNo: "desc" },
    select: { receiptNo: true },
  });
  const next = last ? Number.parseInt(last.receiptNo.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export interface RecordPaymentInput {
  traineeId: string;
  /** Defaults to the trainee's own course. */
  courseId?: string | null;
  /** Positive for a payment, negative for a refund or adjustment. Never zero. */
  amountRwf: number;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date;
  /** Set only by a refund: the payment being reversed. */
  refundOfId?: string | null;
  recorder: Recorder | null;
}

/**
 * Writes one ledger row and brings the trainee's totals up to date. Must be called
 * inside a transaction. An advisory lock serialises receipt numbering, so two
 * payments recorded at once cannot take the same number.
 */
export async function recordPayment(tx: Tx, input: RecordPaymentInput): Promise<Payment> {
  if (!Number.isInteger(input.amountRwf) || input.amountRwf === 0) {
    throw new Error("A payment amount must be a non-zero whole number of francs.");
  }

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ksa-payment-receipt'))`;

  const trainee = await tx.trainee.findUniqueOrThrow({
    where: { id: input.traineeId },
    select: { courseId: true, course: { select: { priceRwf: true, priceTiers: true } } },
  });

  const now = new Date();
  const payment = await tx.payment.create({
    data: {
      receiptNo: await nextReceiptNo(tx, now),
      traineeId: input.traineeId,
      courseId: input.courseId === undefined ? trainee.courseId : input.courseId,
      amountRwf: input.amountRwf,
      method: input.method,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      paidAt: input.paidAt ?? now,
      refundOfId: input.refundOfId ?? null,
      recordedById: input.recorder?.id ?? null,
      recordedByName: input.recorder?.name ?? null,
    },
  });

  await syncTraineeTotals(tx, input.traineeId, settlementAmount(trainee.course));
  return payment;
}

/** Recomputes a trainee's total and status from their ledger rows. */
export async function syncTraineeTotals(tx: Tx, traineeId: string, settlesAtRwf: number): Promise<void> {
  const total = await tx.payment.aggregate({
    where: { traineeId },
    _sum: { amountRwf: true },
  });
  const paid = Math.max(0, total._sum.amountRwf ?? 0);

  await tx.trainee.update({
    where: { id: traineeId },
    data: { amountPaidRwf: paid, paymentStatus: paymentStatusFor(paid, settlesAtRwf) },
  });
}
