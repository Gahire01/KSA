import { z } from "zod";

import { guard } from "@/lib/api/guard";
import { apiFail, apiNotFound, apiOk, zodMessage } from "@/lib/api/response";
import { actorOf, audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120).optional(),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(160).optional(),
  })
  .strict();

/** GET /api/trainers/:id */
export async function GET(_request: Request, { params }: Params) {
  const gate = await guard("trainer.read");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const trainer = await prisma.user.findFirst({
    where: { id, role: "TRAINER" },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  if (!trainer) return apiNotFound("Trainer");
  return apiOk(trainer);
}

/** PATCH /api/trainers/:id — update a trainer's name or email. */
export async function PATCH(request: Request, { params }: Params) {
  const gate = await guard("trainer.manage");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const existing = await prisma.user.findFirst({
    where: { id, role: "TRAINER" },
    select: { id: true },
  });
  if (!existing) return apiNotFound("Trainer");

  if (parsed.data.email) {
    const clash = await prisma.user.findFirst({
      where: { email: parsed.data.email, NOT: { id } },
      select: { id: true },
    });
    if (clash) return apiFail("Someone with that email already exists.", 409);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  await audit({
    ...actorOf(gate.session),
    action: "trainer.update",
    entityType: "User",
    entityId: id,
    meta: { fields: Object.keys(parsed.data) },
  });

  return apiOk(updated);
}
