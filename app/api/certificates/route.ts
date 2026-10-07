import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { certificateListSelect, certificateStatus } from "@/lib/certificates/status";
import { certificateListQuerySchema } from "@/lib/api/certificate-schemas";
import { viaCourse } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * GET /api/certificates — the staff register.
 *
 * Every trainee who has passed, with the derived status, searchable by name, the
 * printed student number and the internal enrolment number.
 */

export async function GET(request: Request) {
  const gate = await guard("certificate.read", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const parsed = certificateListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );

  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const { search, status, courseIds, issuedFrom, issuedTo, page, pageSize } =
    parsed.data;

  /* Status is derived on read, so filtering on it means filtering in memory. The
   * register is bounded to one row per passed exam and stays small, and the derived
   * value is the only correct definition — a `status` column would drift. Everything
   * else is stored, so it filters in SQL and keeps the query cheap. */
  const rows = await prisma.certificate.findMany({
    where: {
      /* A trainer sees only certificates for their own courses. */
      ...viaCourse(gate.trainerScope),
      ...(courseIds?.length ? { courseId: { in: courseIds } } : {}),
      ...(issuedFrom || issuedTo
        ? {
            issuedAt: {
              ...(issuedFrom ? { gte: new Date(`${issuedFrom}T00:00:00.000Z`) } : {}),
              ...(issuedTo ? { lte: new Date(`${issuedTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { trainee: { fullName: { contains: search, mode: "insensitive" } } },
              { trainee: { traineeNo: { contains: search, mode: "insensitive" } } },
              { course: { name: { contains: search, mode: "insensitive" } } },
              { course: { code: { contains: search, mode: "insensitive" } } },
              /* `studentNumber` is an int, so a numeric query is compared as a
               * number rather than substring-matched against its text form. */
              ...(Number.isFinite(Number.parseInt(search, 10))
                ? [{ studentNumber: Number.parseInt(search, 10) }]
                : []),
            ],
          }
        : {}),
    } satisfies Prisma.CertificateWhereInput,
    select: certificateListSelect,
    orderBy: [{ issuedAt: "desc" }],
  });

  const decorated = rows
    .map((row) => ({ ...row, status: certificateStatus(row) }))
    .filter((row) => (status?.length ? status.includes(row.status) : true));

  const total = decorated.length;
  const start = (page - 1) * pageSize;

  return apiOk({
    items: decorated.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
