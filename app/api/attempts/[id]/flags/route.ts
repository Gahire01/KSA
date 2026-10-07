import { z } from "zod";

import { guard } from "@/lib/api/guard";
import { apiFail, apiNotFound, apiOk, zodMessage } from "@/lib/api/response";
import { viaCourse } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";

const reviewSchema = z
  .object({
    index: z.number().int().min(0).max(10_000),
    reviewed: z.boolean(),
  })
  .strict();

/**
 * PATCH /api/attempts/:id/flags { index, reviewed }
 *
 * Staff mark an integrity flag as reviewed. It only ever flips the `reviewed`
 * boolean on an existing entry: a flag cannot be edited or removed from here,
 * so the record of what the runner reported stays intact.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await guard("exam.send", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const body: unknown = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const attempt = await prisma.examAttempt.findFirst({
    where: { id, ...viaCourse(gate.trainerScope) },
    select: { integrityFlags: true },
  });
  if (!attempt) return apiNotFound("Attempt");

  const flags = Array.isArray(attempt.integrityFlags)
    ? (attempt.integrityFlags as Array<Record<string, unknown>>)
    : [];
  const target = flags[parsed.data.index];
  if (!target) return apiFail("That flag does not exist.", 404);

  /* Flip only the one `reviewed` key in place, atomically, so a flag the runner
   * appends at the same moment is never overwritten by a stale copy of the array. */
  let updated = 0;
  try {
    updated = await prisma.$executeRaw`
      UPDATE "ExamAttempt"
      SET "integrityFlags" = jsonb_set(
        "integrityFlags",
        ARRAY[${String(parsed.data.index)}, 'reviewed'],
        to_jsonb(${parsed.data.reviewed}::boolean)
      )
      WHERE "id" = ${id} AND jsonb_array_length("integrityFlags") > ${parsed.data.index}
    `;
  } catch (error) {
    return apiFail("Could not update the flag. Try again.", 500, { logError: error });
  }

  if (updated !== 1) return apiFail("That flag does not exist.", 404);

  await prisma.auditLog
    .create({
      data: {
        actorId: gate.session.user.id,
        actorEmail: gate.session.user.email,
        action: "exam.flag.review",
        entityType: "ExamAttempt",
        entityId: id,
        meta: JSON.stringify({ index: parsed.data.index, type: target.type, reviewed: parsed.data.reviewed }),
      },
    })
    .catch((error: unknown) => console.error("[attempt-flags] audit write failed", error));

  return apiOk({ index: parsed.data.index, reviewed: parsed.data.reviewed });
}
