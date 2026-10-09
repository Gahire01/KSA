import { guard } from "@/lib/api/guard";
import { apiNotFound, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { paymentRow, paymentSelect } from "@/lib/payments/rows";

/** GET /api/payments/:id — one receipt, with the trainee's running balance. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await guard("payment.read");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const row = await prisma.payment.findUnique({ where: { id }, select: paymentSelect });
  if (!row) return apiNotFound("Receipt");

  return apiOk(paymentRow(row));
}
