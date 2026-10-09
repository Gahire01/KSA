import { guard } from "@/lib/api/guard";
import { apiFail, apiNotFound, apiOk, zodMessage } from "@/lib/api/response";
import { traineeUpdateSchema } from "@/lib/api/schemas";
import { actorOf, audit } from "@/lib/audit";
import { viaCourse } from "@/lib/auth/scope";
import { invalidateCourses } from "@/lib/data-cache";
import { prisma } from "@/lib/db";
import { LedgerError, recordPayment, settlementAmount, syncTraineeTotals } from "@/lib/payments/ledger";
import { withoutMoney } from "@/lib/trainees/privacy";
import { traineeInclude } from "@/app/api/trainees/route";

type Params = { params: Promise<{ id: string }> };

/** GET /api/trainees/:id */
export async function GET(_request: Request, { params }: Params) {
  const gate = await guard("trainee.read", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;

  /* The trainer filter is part of the lookup, so another trainer's trainee is simply not found. */
  const trainee = await prisma.trainee.findFirst({
    where: { id, ...viaCourse(gate.trainerScope) },
    include: traineeInclude,
  });
  if (!trainee) return apiNotFound("Trainee");

  return apiOk(gate.trainerScope ? withoutMoney(trainee) : trainee);
}

/** PATCH /api/trainees/:id */
export async function PATCH(request: Request, { params }: Params) {
  const gate = await guard("trainee.update");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = traineeUpdateSchema.safeParse(body);

  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const existing = await prisma.trainee.findUnique({ where: { id } });
  if (!existing) return apiNotFound("Trainee");

  const data = parsed.data;

  if (data.email && data.email.toLowerCase() !== existing.email) {
    const clash = await prisma.trainee.findFirst({
      where: { email: data.email.toLowerCase(), NOT: { id } },
      select: { id: true },
    });
    if (clash) return apiFail("A trainee with that email already exists.", 409);
  }

  if (data.courseId) {
    const course = await prisma.course.findUnique({ where: { id: data.courseId } });
    if (!course) return apiFail("That course does not exist.", 422);
  }

  /* The profile fields and any money change are ONE transaction. Money goes through the ledger:
   * `paymentStatus` from the client is ignored (it is derived), and a changed amount becomes an
   * adjustment row so the trainee's total always equals the sum of their payments. The adjustment
   * is worked out from the CURRENT total read under the ledger lock, not from the copy read above,
   * so a payment recorded in between cannot make the delta wrong. A new course changes what "paid
   * in full" means, so the totals are re-judged. */
  const recorder = { id: gate.session.user.id, name: gate.session.user.name ?? gate.session.user.email };
  const courseChanged = data.courseId !== undefined && (data.courseId ?? null) !== existing.courseId;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ksa-payment-receipt'))`;

      await tx.trainee.update({
        where: { id },
        data: {
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.email !== undefined ? { email: data.email.toLowerCase() } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.countryCode !== undefined ? { countryCode: data.countryCode } : {}),
          ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
          ...(data.courseId !== undefined ? { courseId: data.courseId ?? null } : {}),
          ...(data.deadlineAt !== undefined ? { deadlineAt: data.deadlineAt ?? null } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
        },
      });

      const current = await tx.trainee.findUniqueOrThrow({ where: { id }, select: { amountPaidRwf: true } });
      const delta = data.amountPaidRwf === undefined ? 0 : data.amountPaidRwf - current.amountPaidRwf;
      if (delta !== 0) {
        await recordPayment(tx, {
          traineeId: id,
          amountRwf: delta,
          method: "CASH",
          notes: "Adjusted on the trainee record",
          recorder,
        });
      } else if (courseChanged) {
        const course = data.courseId
          ? await tx.course.findUnique({ where: { id: data.courseId }, select: { priceRwf: true, priceTiers: true } })
          : null;
        await syncTraineeTotals(tx, id, settlementAmount(course));
      }
    });
  } catch (error) {
    if (error instanceof LedgerError) return apiFail(error.message, 409);
    throw error;
  }

  if (courseChanged) await invalidateCourses();

  const trainee = await prisma.trainee.findUniqueOrThrow({ where: { id }, include: traineeInclude });

  /* Field names only: the values are personal data and the log is not the place for them. */
  await audit({
    ...actorOf(gate.session),
    action: "trainee.update",
    entityType: "Trainee",
    entityId: id,
    meta: { fields: Object.keys(data) },
  });

  return apiOk(trainee);
}

/** DELETE /api/trainees/:id */
export async function DELETE(_request: Request, { params }: Params) {
  const gate = await guard("trainee.delete");
  if (!gate.ok) return gate.response;

  const { id } = await params;

  const existing = await prisma.trainee.findUnique({
    where: { id },
    select: { id: true, fullName: true, traineeNo: true, _count: { select: { certificates: true, payments: true } } },
  });
  if (!existing) return apiNotFound("Trainee");

  /* The payments register is never erased. A trainee with receipts is withdrawn, not deleted. */
  if (existing._count.payments > 0) {
    return apiFail(
      "This trainee has payment records. Set their status to Withdrawn instead; deleting would erase the receipts.",
      409,
    );
  }

  /* The database would cascade this delete to every certificate the trainee holds,
   * silently invalidating documents already in people's hands and breaking their
   * public verification pages. Revoking a certificate keeps the record; deleting does not. */
  if (existing._count.certificates > 0) {
    return apiFail(
      "This trainee has issued certificates. Revoke them instead; deleting would erase them.",
      409,
    );
  }

  await prisma.trainee.delete({ where: { id } });
  await invalidateCourses();

  await audit({
    ...actorOf(gate.session),
    action: "trainee.delete",
    entityType: "Trainee",
    entityId: id,
    meta: { traineeNo: existing.traineeNo },
  });

  return apiOk({ id, deleted: true, fullName: existing.fullName });
}
