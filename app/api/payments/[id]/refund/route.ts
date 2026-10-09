import { guard } from "@/lib/api/guard";
import { apiFail, apiNotFound, apiOk, zodMessage } from "@/lib/api/response";
import { refundSchema } from "@/lib/api/payment-schemas";
import { actorOf, audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { recordPayment } from "@/lib/payments/ledger";
import { paymentRow, paymentSelect } from "@/lib/payments/rows";

/**
 * POST /api/payments/:id/refund { reason }
 *
 * Reverses a payment by adding a negative entry that points back at it; the original is
 * never touched. A payment can be refunded once (the refund's `refundOfId` is unique), and
 * a refund cannot itself be refunded. Owner only.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await guard("payment.refund");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = refundSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const original = await prisma.payment.findUnique({
    where: { id },
    select: { id: true, traineeId: true, courseId: true, amountRwf: true, method: true, receiptNo: true, refundOfId: true, refund: { select: { id: true } } },
  });
  if (!original) return apiNotFound("Receipt");
  if (original.refundOfId || original.amountRwf <= 0) return apiFail("Only a payment can be refunded.", 409);
  if (original.refund) return apiFail("This payment has already been refunded.", 409);

  let refund;
  try {
    refund = await prisma.$transaction((tx) =>
      recordPayment(tx, {
        traineeId: original.traineeId,
        courseId: original.courseId,
        amountRwf: -original.amountRwf,
        method: original.method,
        reference: `Refund of ${original.receiptNo}`,
        notes: parsed.data.reason,
        refundOfId: original.id,
        recorder: { id: gate.session.user.id, name: gate.session.user.name ?? gate.session.user.email },
      }),
    );
  } catch (error) {
    /* The unique refundOfId index: a concurrent refund of the same payment won the race. */
    if ((error as { code?: string } | null)?.code === "P2002") {
      return apiFail("This payment has already been refunded.", 409);
    }
    return apiFail("Could not record the refund. Try again.", 500, { logError: error });
  }

  await audit({
    ...actorOf(gate.session),
    action: "payment.refund",
    entityType: "Payment",
    entityId: refund.id,
    meta: { refundOf: original.receiptNo, amountRwf: refund.amountRwf, reason: parsed.data.reason },
  });

  const row = await prisma.payment.findUniqueOrThrow({ where: { id: refund.id }, select: paymentSelect });
  return apiOk(paymentRow(row), 201);
}
