import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { traineeCreateSchema, traineeListQuerySchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { REGISTER_MAX_STUDENT_NUMBER } from "../../../scripts/student-list/register-numbers";

export const traineeInclude = {
  course: { select: { id: true, code: true, name: true, priceRwf: true } },
  category: { select: { id: true, name: true } },
} as const;

/**
 * Next student number: plain digits, continuing from the highest number held
 * (never below the academy's register, whose last slot is 456, so the first new
 * trainee is 457). No prefix: this is also the number printed on the certificate.
 *
 * The maximum is taken numerically in SQL over the all-digit numbers only. A
 * string sort would rank "99" above "456", and a legacy "KSA-0001" above both.
 * Two simultaneous creates could pick the same number; the unique index then
 * rejects the loser, which the caller retries.
 */
async function nextTraineeNo(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ highest: number | null }>>`
    SELECT MAX("traineeNo"::bigint)::int AS highest
    FROM "Trainee"
    WHERE "traineeNo" ~ '^[0-9]{1,9}$'
  `;

  const highest = Math.max(rows[0]?.highest ?? 0, REGISTER_MAX_STUDENT_NUMBER);
  return String(highest + 1);
}

/** GET /api/trainees — search, filter, paginated. */
export async function GET(request: Request) {
  const gate = await guard("trainee.read");
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
  const payment = d.paymentStatus ?? d.paymentStatuses;
  const courseIds = d.courseId ?? d.courseIds;
  const categoryIds = d.categoryId ?? d.categoryIds;
  const countries = d.country ?? d.countries;

  const where: Prisma.TraineeWhereInput = {
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
    items,
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
      const trainee = await prisma.trainee.create({
        data: {
          traineeNo: await nextTraineeNo(),
          fullName: data.fullName,
          email: data.email.toLowerCase(),
          phone: data.phone,
          countryCode: data.countryCode,
          categoryId: data.categoryId,
          courseId,
          deadlineAt: data.deadlineAt ?? null,
          status: data.status,
          paymentStatus: data.paymentStatus,
          amountPaidRwf: data.amountPaidRwf,
          notes: data.notes ?? null,
        },
        include: traineeInclude,
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
