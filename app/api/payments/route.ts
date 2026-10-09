import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { paymentCreateSchema, paymentListQuerySchema } from "@/lib/api/payment-schemas";
import { actorOf, audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { recordPayment } from "@/lib/payments/ledger";
import { paymentRow, paymentSelect } from "@/lib/payments/rows";

/** GET /api/payments — the register, newest first. Owner and admin only. */
export async function GET(request: Request) {
  const gate = await guard("payment.read");
  if (!gate.ok) return gate.response;

  const parsed = paymentListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);
  const q = parsed.data;

  const where: Prisma.PaymentWhereInput = {
    ...(q.traineeId ? { traineeId: q.traineeId } : {}),
    ...(q.courseIds?.length ? { courseId: { in: q.courseIds } } : {}),
    ...(q.methods?.length ? { method: { in: q.methods } } : {}),
    ...(q.statuses?.length ? { trainee: { paymentStatus: { in: q.statuses } } } : {}),
    /* `to` is a calendar day from the date picker, so it runs to the end of that day. */
    ...(q.from || q.to
      ? { paidAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: new Date(q.to.getTime() + 86_399_999) } : {}) } }
      : {}),
    ...(q.search
      ? {
          OR: [
            { receiptNo: { contains: q.search, mode: "insensitive" } },
            { reference: { contains: q.search, mode: "insensitive" } },
            { trainee: { fullName: { contains: q.search, mode: "insensitive" } } },
            { trainee: { traineeNo: { contains: q.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: paymentSelect,
    }),
    prisma.payment.count({ where }),
  ]);

  return apiOk({
    items: rows.map(paymentRow),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  });
}

/** POST /api/payments — record a payment against a trainee. */
export async function POST(request: Request) {
  const gate = await guard("payment.write");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = paymentCreateSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);
  const input = parsed.data;

  const trainee = await prisma.trainee.findUnique({
    where: { id: input.traineeId },
    select: { id: true, fullName: true },
  });
  if (!trainee) return apiFail("That trainee does not exist.", 422);

  let created;
  try {
    created = await prisma.$transaction((tx) =>
      recordPayment(tx, {
        traineeId: input.traineeId,
        amountRwf: input.amountRwf,
        method: input.method,
        reference: input.reference,
        notes: input.notes,
        paidAt: input.paidAt,
        recorder: { id: gate.session.user.id, name: gate.session.user.name ?? gate.session.user.email },
      }),
    );
  } catch (error) {
    return apiFail("Could not record that payment. Try again.", 500, { logError: error });
  }

  await audit({
    ...actorOf(gate.session),
    action: "payment.record",
    entityType: "Payment",
    entityId: created.id,
    meta: { receiptNo: created.receiptNo, traineeId: trainee.id, amountRwf: created.amountRwf, method: created.method },
  });

  const row = await prisma.payment.findUniqueOrThrow({ where: { id: created.id }, select: paymentSelect });
  return apiOk(paymentRow(row), 201);
}
