import { guard } from "@/lib/api/guard";
import { apiFail, apiNotFound, apiOk, zodMessage } from "@/lib/api/response";
import { courseUpdateSchema } from "@/lib/api/schemas";
import { actorOf, audit } from "@/lib/audit";
import { isActiveTrainer, ownsCourse } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";
import { standardPrice } from "@/lib/courses/pricing";
import { resettleCourse } from "@/lib/payments/ledger";
import { invalidateCourses } from "@/lib/data-cache";

type Params = { params: Promise<{ id: string }> };

/** GET /api/courses/:id */
export async function GET(_request: Request, { params }: Params) {
  const gate = await guard("course.read", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { trainees: true } },
    },
  });

  /* Another trainer's course is "not found", not "forbidden": its existence is not theirs to know. */
  if (!course || !ownsCourse(gate.trainerScope, course)) return apiNotFound("Course");

  return apiOk(course);
}

/** PATCH /api/courses/:id */
export async function PATCH(request: Request, { params }: Params) {
  const gate = await guard("course.update");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = courseUpdateSchema.safeParse(body);

  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) return apiNotFound("Course");

  const data = parsed.data;

  if (data.code && data.code !== existing.code) {
    const clash = await prisma.course.findUnique({ where: { code: data.code } });
    if (clash) return apiFail(`Course code ${data.code} is already in use.`, 409);
  }

  if (data.categoryId && data.categoryId !== existing.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return apiFail("That category does not exist.", 422);
  }

  const newTrainerId = data.trainerId === undefined ? undefined : data.trainerId || null;
  if (newTrainerId && newTrainerId !== existing.trainerId && !(await isActiveTrainer(newTrainerId))) {
    return apiFail("That trainer does not exist or is not active.", 422);
  }

  const priceChanged = data.priceTiers !== undefined || data.priceRwf !== undefined;

  /* The course update and the re-judging of its trainees' payment status are one transaction,
   * so a price change can never leave anyone marked paid against the old prices. */
  const course = await prisma.$transaction(async (tx) => {
    const updated = await tx.course.update({
    where: { id },
    data: {
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.topics !== undefined ? { topics: data.topics } : {}),
      ...(data.durationValue !== undefined ? { durationValue: data.durationValue } : {}),
      ...(data.durationUnit !== undefined ? { durationUnit: data.durationUnit } : {}),
      /* Packages, when sent, decide the standard price too; a bare priceRwf edits it alone. */
      ...(data.priceTiers !== undefined
        ? { priceTiers: data.priceTiers, priceRwf: standardPrice(data.priceTiers) }
        : data.priceRwf !== undefined
          ? { priceRwf: data.priceRwf }
          : {}),
      ...(data.passMarkPct !== undefined ? { passMarkPct: data.passMarkPct } : {}),
      ...(data.maxAttempts !== undefined ? { maxAttempts: data.maxAttempts } : {}),
      ...(data.examDurationMin !== undefined
        ? { examDurationMin: data.examDurationMin }
        : {}),
      ...(newTrainerId !== undefined ? { trainerId: newTrainerId } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    include: { category: { select: { id: true, name: true } } },
    });
    if (priceChanged) await resettleCourse(tx, id, updated);
    return updated;
  });
  await invalidateCourses();

  await audit({
    ...actorOf(gate.session),
    action: "course.update",
    entityType: "Course",
    entityId: id,
    meta: { fields: Object.keys(data) },
  });

  return apiOk(course);
}

/**
 * DELETE /api/courses/:id
 *
 * Refuses while trainees are still linked, so removing a course cannot orphan
 * enrolments. Deactivate it instead in that case.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const gate = await guard("course.delete");
  if (!gate.ok) return gate.response;

  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: { _count: { select: { trainees: true, certificates: true } } },
  });

  if (!course) return apiNotFound("Course");

  if (course._count.trainees > 0) {
    return apiFail(
      `${course._count.trainees} trainee(s) are still enrolled on this course. Deactivate it instead.`,
      409,
    );
  }

  /* Deleting the course would cascade to every certificate issued for it. */
  if (course._count.certificates > 0) {
    return apiFail(
      "Certificates have been issued for this course. Deactivate it instead; deleting would erase them.",
      409,
    );
  }

  await prisma.course.delete({ where: { id } });
  await invalidateCourses();

  await audit({
    ...actorOf(gate.session),
    action: "course.delete",
    entityType: "Course",
    entityId: id,
    meta: { code: course.code },
  });

  return apiOk({ id, deleted: true });
}
