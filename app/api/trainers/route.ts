import { randomBytes } from "node:crypto";
import { z } from "zod";

import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

/**
 * /api/trainers — the people who run courses.
 *
 * A trainer is a TRAINER-role user, but not someone who signs in with a password:
 * the owner creates the record here and then gives them a link (see access links).
 * The account is created with a random, discarded password and a real contact email
 * (used only to attribute their work), so it cannot be signed into any other way.
 */

const createSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the trainer's name.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(160),
  })
  .strict();

export async function GET() {
  const gate = await guard("trainer.read");
  if (!gate.ok) return gate.response;

  const trainers = await prisma.user.findMany({
    where: { role: "TRAINER", isActive: true, NOT: { email: { endsWith: "@access.invalid" } } },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return apiOk({ items: trainers, total: trainers.length });
}

export async function POST(request: Request) {
  const gate = await guard("trainer.manage");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) return apiFail("Someone with that email already exists.", 409);

  try {
    const trainer = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
        role: "TRAINER",
        totpEnabled: false,
      },
      select: { id: true, name: true, email: true },
    });

    await prisma.auditLog
      .create({
        data: {
          actorId: gate.session.user.id,
          actorEmail: gate.session.user.email,
          action: "trainer.create",
          entityType: "User",
          entityId: trainer.id,
          meta: JSON.stringify({ name: trainer.name }),
        },
      })
      .catch((error: unknown) => console.error("[trainers] audit write failed", error));

    return apiOk(trainer, 201);
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2002") {
      return apiFail("Someone with that email already exists.", 409);
    }
    return apiFail("Could not create the trainer. Try again.", 500, { logError: error });
  }
}
