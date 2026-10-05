import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { categoryCreateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";

/** GET /api/categories — ordered by name, used to populate course/trainee selects. */
export async function GET() {
  const gate = await guard("category.read");
  if (!gate.ok) return gate.response;

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { courses: true } } },
  });

  return apiOk(
    categories.map((c) => ({ id: c.id, name: c.name, courseCount: c._count.courses })),
  );
}

/** POST /api/categories */
export async function POST(request: Request) {
  const gate = await guard("category.create");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = categoryCreateSchema.safeParse(body);

  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const name = parsed.data.name;

  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) return apiFail("That category already exists.", 409);

  const category = await prisma.category.create({ data: { name } });

  return apiOk({ id: category.id, name: category.name, courseCount: 0 }, 201);
}
