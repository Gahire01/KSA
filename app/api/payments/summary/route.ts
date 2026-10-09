import { guard } from "@/lib/api/guard";
import { apiOk } from "@/lib/api/response";
import { settlementPrice } from "@/lib/courses/pricing";
import { prisma } from "@/lib/db";

/**
 * GET /api/payments/summary — the figures above the register.
 *
 * Refund entries are negative, so every sum here is already net of refunds.
 * "Outstanding" is what enrolled trainees still owe against their course's price.
 */
export async function GET() {
  const gate = await guard("payment.read");
  if (!gate.ok) return gate.response;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [all, thisMonth, lastMonth, debtors, byStatus] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amountRwf: true }, _count: { _all: true } }),
    prisma.payment.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amountRwf: true } }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: lastMonthStart, lt: monthStart } },
      _sum: { amountRwf: true },
    }),
    prisma.trainee.findMany({
      where: { status: { in: ["PENDING", "ACTIVE"] }, courseId: { not: null }, paymentStatus: { not: "PAID" } },
      select: { amountPaidRwf: true, course: { select: { priceRwf: true, priceTiers: true } } },
    }),
    prisma.trainee.groupBy({ by: ["paymentStatus"], _count: { _all: true } }),
  ]);

  const outstandingRwf = debtors.reduce(
    /* What it takes to count as paid in full (the cheapest package), the same rule the ledger uses. */
    (sum, t) => sum + Math.max(0, settlementPrice(t.course) - t.amountPaidRwf),
    0,
  );
  const count = (s: string) => byStatus.find((r) => r.paymentStatus === s)?._count._all ?? 0;

  return apiOk({
    collectedTotalRwf: all._sum.amountRwf ?? 0,
    collectedThisMonthRwf: thisMonth._sum.amountRwf ?? 0,
    collectedLastMonthRwf: lastMonth._sum.amountRwf ?? 0,
    entries: all._count._all,
    outstandingRwf,
    traineesPaid: count("PAID"),
    traineesPartial: count("PARTIAL"),
    traineesUnpaid: count("UNPAID"),
  });
}
