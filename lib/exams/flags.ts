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

  /* A leave is logged as { type: "tab_leave", at, count }, `count` being the running
   * total including this one. It is computed in the same statement as the increment
   * (the right-hand side still sees the old "blurCount"), so two racing leaves cannot
   * both claim to be the first. */
  await prisma.$executeRaw`
    UPDATE "ExamAttempt"
    SET "integrityFlags" = CASE
          WHEN jsonb_array_length(COALESCE("integrityFlags", '[]'::jsonb)) < ${MAX_FLAGS}
            THEN COALESCE("integrityFlags", '[]'::jsonb) ||
                 jsonb_build_array(${JSON.stringify(flag)}::jsonb ||
                   CASE WHEN ${increment} = 1
                     THEN jsonb_build_object('count', "blurCount" + 1)
                     ELSE '{}'::jsonb
                   END)
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
