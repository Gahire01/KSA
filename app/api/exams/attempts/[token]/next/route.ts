import { NextResponse } from "next/server";

import { apiFail } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { loadAttemptByToken, manifestOf, secondsRemaining } from "@/lib/exams/attempt";
import { readExamSession } from "@/lib/exams/session-cookie";

/**
 * GET /api/exams/attempts/:token/next
 *
 * Returns the questions of this sitting with their options **in the order the
 * manifest froze**, plus the saved answers.
 *
 * `isCorrect` is stripped here by projection, not by a caller-side delete — the
 * option rows are selected with `id` and `text` only, so the flag is never
 * loaded from Postgres in the first place.
 *
 * Requires the exam-session cookie minted by verify-otp.
 */

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const attempt = await loadAttemptByToken(token);
  if (!attempt) return apiFail("This exam link is not valid.", 404);

  /* The cookie is checked before the status so that anyone who has not yet proved
   * possession of the emailed code gets the same "enter the code" answer whatever
   * state the attempt is in. Checking status first would tell a stranger holding
   * nothing but a link whether the sitting is pending, open or already finished. */
  if (!(await readExamSession(token, attempt.id))) {
    return apiFail("Enter the code we emailed you to open this exam.", 401);
  }

  /* Reuse of a submitted token is refused here as well as in verify-otp. */
  if (attempt.status !== "STARTED") {
    return apiFail("This exam is not open.", 410);
  }

  const manifest = manifestOf(attempt);
  if (!manifest) return apiFail("This exam paper could not be read.", 500);

  const secondsLeft = secondsRemaining(attempt);
  if (secondsLeft <= 0) {
    return apiFail("Time is up. Submit your answers.", 410);
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: manifest.questionIds } },
    select: {
      id: true,
      text: true,
      /* isCorrect deliberately absent from this select. */
      options: {
        orderBy: { position: "asc" },
        select: { id: true, text: true },
      },
    },
  });

  const byId = new Map(questions.map((q) => [q.id, q]));
  const saved = await prisma.examAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, optionId: true },
  });
  const answers: Record<string, string> = {};
  for (const row of saved) {
    if (row.optionId) answers[row.questionId] = row.optionId;
  }

  const ordered = manifest.questions.flatMap((entry) => {
    const question = byId.get(entry.questionId);
    if (!question) return [];
    const optionsById = new Map(question.options.map((o) => [o.id, o]));
    return [
      {
        id: question.id,
        text: question.text,
        /* Reordered to the manifest's frozen sequence. */
        options: entry.optionIds.flatMap((id) => {
          const option = optionsById.get(id);
          return option ? [option] : [];
        }),
      },
    ];
  });

  return NextResponse.json({
    ok: true,
    data: {
      questions: ordered,
      answers,
      secondsLeft,
      examDurationMin: attempt.durationMin,
      courseName: attempt.course.name,
      traineeName: attempt.trainee.fullName,
      passMarkPct: attempt.course.passMarkPct,
      attemptNumber: attempt.attemptNumber,
      maxAttempts: attempt.course.maxAttempts,
      startedAt: attempt.startedAt?.toISOString() ?? null,
      linkExpiresAt: attempt.linkExpiresAt.toISOString(),
    },
  });
}