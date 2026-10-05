import { guard } from "@/lib/api/guard";
import { apiFail, apiNotFound, apiOk, zodMessage } from "@/lib/api/response";
import { courseUpdateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** GET /api/courses/:id */
export async function GET(_request: Request, { params }: Params) {
  const gate = await guard("course.read");
  if (!gate.ok) return gate.response;

  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { trainees: true } },
    },
  });

  if (!course) return apiNotFound("Course");

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

  const course = await prisma.course.update({
    where: { id },
    data: {
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.topics !== undefined ? { topics: data.topics } : {}),
      ...(data.durationValue !== undefined ? { durationValue: data.durationValue } : {}),
      ...(data.durationUnit !== undefined ? { durationUnit: data.durationUnit } : {}),
      ...(data.priceRwf !== undefined ? { priceRwf: data.priceRwf } : {}),
      ...(data.passMarkPct !== undefined ? { passMarkPct: data.passMarkPct } : {}),
      ...(data.maxAttempts !== undefined ? { maxAttempts: data.maxAttempts } : {}),
      ...(data.validityMonths !== undefined
        ? { validityMonths: data.validityMonths ?? null }
        : {}),
      ...(data.examDurationMin !== undefined
        ? { examDurationMin: data.examDurationMin }
        : {}),
      ...(data.trainerId !== undefined ? { trainerId: data.trainerId ?? null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    include: { category: { select: { id: true, name: true } } },
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
    include: { _count: { select: { trainees: true } } },
  });

  if (!course) return apiNotFound("Course");

  if (course._count.trainees > 0) {
    return apiFail(
      `${course._count.trainees} trainee(s) are still enrolled on this course. Deactivate it instead.`,
      409,
    );
  }

  await prisma.course.delete({ where: { id } });

  return apiOk({ id, deleted: true });
}
