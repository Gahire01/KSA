import { prisma } from "@/lib/db";

/** Hard ceiling on stored flags per sitting. */
export const MAX_FLAGS = 500;

/**
 * Appends one integrity flag to an attempt in a single atomic statement.
 *
 * A blur and a tab_switch fire together on every tab switch, so a read-then-write
 * of the whole array would lose one of them. `jsonb ||` appends without reading,
 * the blur counter moves in the same statement, and the array is capped so a
 * client cannot grow a row without bound (the blur counter keeps counting past
 * the cap, so an auto-submit threshold never goes quiet).
 *
 * Returns the blur count after the update, or null if the attempt is gone.
 */
export async function appendIntegrityFlag(
  attemptId: string,
  type: string,
  options: { countsAsBlur?: boolean } = {},
): Promise<number | null> {
  const flag = { type, at: new Date().toISOString(), reviewed: false };
  const increment = options.countsAsBlur ? 1 : 0;

  await prisma.$executeRaw`
    UPDATE "ExamAttempt"
    SET "integrityFlags" = CASE
          WHEN jsonb_array_length(COALESCE("integrityFlags", '[]'::jsonb)) < ${MAX_FLAGS}
            THEN COALESCE("integrityFlags", '[]'::jsonb) || ${JSON.stringify([flag])}::jsonb
          ELSE "integrityFlags"
        END,
        "blurCount" = "blurCount" + ${increment}
    WHERE "id" = ${attemptId}
  `;

  const row = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: { blurCount: true },
  });
  return row?.blurCount ?? null;
}
