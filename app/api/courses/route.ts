import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { courseCreateSchema, courseListQuerySchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/** GET /api/courses — search, filter by category/active, paginated. */
export async function GET(request: Request) {
  const gate = await guard("course.read");
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const parsed = courseListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );

  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const { search, isActive, page, pageSize } = parsed.data;
  const categoryIds = parsed.data.categoryId ?? parsed.data.categoryIds;

  const where: Prisma.CourseWhereInput = {
    ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
    ...(typeof isActive === "boolean" ? { isActive } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { trainees: true } },
      },
    }),
    prisma.course.count({ where }),
  ]);

  return apiOk({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

/** POST /api/courses */
export async function POST(request: Request) {
  const gate = await guard("course.create");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = courseCreateSchema.safeParse(body);

  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const data = parsed.data;

  const [category, duplicate] = await Promise.all([
    prisma.category.findUnique({ where: { id: data.categoryId } }),
    prisma.course.findUnique({ where: { code: data.code } }),
  ]);

  if (!category) return apiFail("That category does not exist.", 422);
  if (duplicate) return apiFail(`Course code ${data.code} is already in use.`, 409);

  const course = await prisma.course.create({
    data: {
      code: data.code,
      name: data.name,
      categoryId: data.categoryId,
      description: data.description ?? null,
      topics: data.topics,
      durationValue: data.durationValue,
      durationUnit: data.durationUnit,
      priceRwf: data.priceRwf,
      passMarkPct: data.passMarkPct,
      maxAttempts: data.maxAttempts,
      validityMonths: data.validityMonths ?? null,
      examDurationMin: data.examDurationMin,
      trainerId: data.trainerId ?? null,
      isActive: data.isActive,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return apiOk(course, 201);
}
