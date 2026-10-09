import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { traineeCreateSchema, traineeListQuerySchema } from "@/lib/api/schemas";
import { actorOf, audit } from "@/lib/audit";
import { viaCourse } from "@/lib/auth/scope";
import { invalidateCourses } from "@/lib/data-cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { emit, ownerAndTrainerIds, ownerIds } from "@/lib/notifications/emit";
import { recordPayment } from "@/lib/payments/ledger";
import { nextTraineeNo } from "@/lib/trainees/number";
import { withoutMoney } from "@/lib/trainees/privacy";

export const traineeInclude = {
  course: { select: { id: true, code: true, name: true, priceRwf: true } },
  category: { select: { id: true, name: true } },
} as const;

/** GET /api/trainees — search, filter, paginated. */
export async function GET(request: Request) {
  const gate = await guard("trainee.read", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const parsed = traineeListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );

  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const { search, page, pageSize } = parsed.data;
  const d = parsed.data;

  /* Each filter accepts either a single value or a CSV list, and both spellings
   * of the plural alias are accepted so the UI can use its own names. */
  const statuses = d.status ?? d.statuses;
  /* A trainer cannot filter by what people owe: that would leak it through the result set. */
  const payment = gate.trainerScope ? undefined : (d.paymentStatus ?? d.paymentStatuses);
  const courseIds = d.courseId ?? d.courseIds;
  const categoryIds = d.categoryId ?? d.categoryIds;
  const countries = d.country ?? d.countries;

  const where: Prisma.TraineeWhereInput = {
    /* A trainer sees only trainees enrolled on their own courses. */
    ...viaCourse(gate.trainerScope),
    ...(statuses?.length ? { status: { in: [...statuses] } } : {}),
    ...(courseIds?.length ? { courseId: { in: courseIds } } : {}),
    ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
    ...(payment?.length ? { paymentStatus: { in: [...payment] } } : {}),
    ...(countries?.length ? { countryCode: { in: countries } } : {}),
    ...(d.enrolledFrom || d.enrolledTo
      ? {
          enrolledAt: {
            ...(d.enrolledFrom ? { gte: d.enrolledFrom } : {}),
            ...(d.enrolledTo ? { lte: new Date(d.enrolledTo.getTime() + 86_399_999) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { traineeNo: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.trainee.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: traineeInclude,
    }),
    prisma.trainee.count({ where }),
  ]);

  return apiOk({
    items: gate.trainerScope ? items.map(withoutMoney) : items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

/** POST /api/trainees */
export async function POST(request: Request) {
  const gate = await guard("trainee.create");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = traineeCreateSchema.safeParse(body);

  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const data = parsed.data;

  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) return apiFail("That category does not exist.", 422);

  /* Tidy the enrolment number up to match how the academy displays it. */
  data.countryCode = data.countryCode
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

  let courseId: string | null = null;
  if (data.courseId) {
    const course = await prisma.course.findUnique({ where: { id: data.courseId } });
    if (!course) return apiFail("That course does not exist.", 422);
    courseId = course.id;
  }

  const duplicate = await prisma.trainee.findFirst({
    where: { email: data.email.toLowerCase() },
    select: { id: true },
  });
  if (duplicate) {
    return apiFail("A trainee with that email already exists.", 409);
  }

  /* Retry a couple of times if a concurrent create claimed the same number. */
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const traineeNo = await nextTraineeNo();

      /* The trainee and any opening payment are written in ONE transaction: either both exist or
       * neither does, so a failed payment can never leave a trainee behind (whose retry would then
       * be refused as a duplicate email). The amount goes through the ledger so the trainee's
       * total, status and the payments register all agree; `paymentStatus` from the client is
       * ignored, it is derived from the money. */
      const trainee = await prisma.$transaction(async (tx) => {
        const created = await tx.trainee.create({
          data: {
            traineeNo,
            fullName: data.fullName,
            email: data.email.toLowerCase(),
            phone: data.phone,
            countryCode: data.countryCode,
            categoryId: data.categoryId,
            courseId,
            deadlineAt: data.deadlineAt ?? null,
            status: data.status,
            notes: data.notes ?? null,
          },
          select: { id: true },
        });
        if (data.amountPaidRwf > 0) {
          await recordPayment(tx, {
            traineeId: created.id,
            amountRwf: data.amountPaidRwf,
            method: "CASH",
            notes: "Paid at enrolment",
            recorder: { id: gate.session.user.id, name: gate.session.user.name ?? gate.session.user.email },
          });
        }
        return tx.trainee.findUniqueOrThrow({ where: { id: created.id }, include: traineeInclude });
      });

      await audit({
        ...actorOf(gate.session),
        action: "trainee.create",
        entityType: "Trainee",
        entityId: trainee.id,
        meta: { traineeNo: trainee.traineeNo, courseId },
      });

      await invalidateCourses();
      await emit("trainee.enrolled", {
        recipients: (courseId ? await ownerAndTrainerIds(courseId) : await ownerIds()).map((userId) => ({ userId })),
        title: "New trainee enrolled",
        link: `/trainees/${trainee.id}`,
        body: `${trainee.fullName} (${trainee.traineeNo}) was enrolled${trainee.course ? ` in ${trainee.course.name}` : ""}.`,
      });

      return apiOk(trainee, 201);
    } catch (error) {
      const isTraineeNoClash =
        typeof error === "object" &&
        error !== null &&
        (error as { code?: string }).code === "P2002" &&
        String((error as { meta?: { target?: unknown } }).meta?.target ?? "").includes(
          "traineeNo",
        );

      /* Not a number collision: a real failure. Log it with the cause rather
       * than letting the raw Prisma error reach the client. */
      if (!isTraineeNoClash || attempt === 2) {
        return apiFail("Could not create that trainee. Try again.", 500, { logError: error });
      }
    }
  }

  return apiFail("Could not allocate an enrolment number. Try again.", 503);
}
