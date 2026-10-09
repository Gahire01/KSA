import type { Prisma } from "@/lib/generated/prisma/client";

/** The columns every payments endpoint returns, and the shape the pages read. */
export const paymentSelect = {
  id: true,
  receiptNo: true,
  amountRwf: true,
  method: true,
  reference: true,
  notes: true,
  paidAt: true,
  recordedByName: true,
  refundOfId: true,
  refund: { select: { id: true, receiptNo: true } },
  trainee: {
    select: { id: true, fullName: true, traineeNo: true, email: true, amountPaidRwf: true, paymentStatus: true },
  },
  course: { select: { id: true, name: true, code: true, priceRwf: true } },
} satisfies Prisma.PaymentSelect;

type Row = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

export function paymentRow(row: Row) {
  return {
    id: row.id,
    receiptNo: row.receiptNo,
    amountRwf: row.amountRwf,
    method: row.method,
    reference: row.reference,
    notes: row.notes,
    paidAt: row.paidAt.toISOString(),
    recordedByName: row.recordedByName,
    /** A refund entry: negative, pointing at the payment it reverses. */
    isRefund: row.refundOfId !== null,
    refundOfId: row.refundOfId,
    /** The refund entry that reversed this payment, if any. */
    refundedBy: row.refund ? { id: row.refund.id, receiptNo: row.refund.receiptNo } : null,
    trainee: row.trainee,
    course: row.course,
  };
}

export type PaymentRow = ReturnType<typeof paymentRow>;
