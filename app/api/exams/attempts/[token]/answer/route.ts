import { NextResponse } from "next/server";

import { examAnswerSchema } from "@/lib/api/exam-schemas";
import { EXAM_AUTOSAVE_LIMIT, clientKey, rateLimit, rateLimitFail } from "@/lib/api/rate-limit";
import { apiFail, zodMessage } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { loadAttemptByToken, manifestOf, secondsRemaining } from "@/lib/exams/attempt";
import { SUBMIT_GRACE_SECONDS } from "@/lib/exams/finalize";
import { readExamSession } from "@/lib/exams/session-cookie";

/**
 * POST /api/exams/attempts/:token/answer
 *
 * Autosave target. The runner posts one answer as the trainee moves, so a
 * refresh, a dropped connection or a closed laptop never loses work.
 *
 * The question id must be in this sitting's manifest and the option id must
 * belong to that question — otherwise the endpoint would accept a write against
 * any row in the database.
 *
 * `isCorrect` is never computed here. Grading happens once, on submit.
 */

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  /* Rate limited per token and per IP: autosave must not become a write oracle. */
  const limit = rateLimit(`exam-save:${token}`, EXAM_AUTOSAVE_LIMIT.max, EXAM_AUTOSAVE_LIMIT.windowMs);
  if (!limit.ok) return rateLimitFail(limit.retryAfterSeconds);

  const ipLimit = rateLimit(
    clientKey(request, "exam-save-ip"),
    EXAM_AUTOSAVE_LIMIT.max * 4,
    EXAM_AUTOSAVE_LIMIT.windowMs,
  );
  if (!ipLimit.ok) return rateLimitFail(ipLimit.retryAfterSeconds);

  const attempt = await loadAttemptByToken(token);
  if (!attempt) return apiFail("This exam link is not valid.", 404);
  if (attempt.status !== "STARTED") return apiFail("This exam is not open.", 410);

  if (!(await readExamSession(token, attempt.id))) {
    return apiFail("Enter the code we emailed you to open this exam.", 401);
  }

  /* The grace covers the final autosave that races the submit; past it nothing
   * more is accepted, so a late submit can only ever grade what was saved in time. */
  if (secondsRemaining(attempt) + SUBMIT_GRACE_SECONDS <= 0) {
    return apiFail("Time is up. Submit your answers.", 410);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = examAnswerSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const manifest = manifestOf(attempt);
  if (!manifest) return apiFail("This exam paper could not be read.", 500);

  const { questionId, optionId, blurCount } = parsed.data;

  if (!manifest.questionIds.includes(questionId)) {
    return apiFail("That question is not part of this exam.", 422);
  }

  let finalOptionId: string | null = null;

  if (optionId) {
    const entry = manifest.questions.find((q) => q.questionId === questionId);
    if (!entry?.optionIds.includes(optionId)) {
      return apiFail("That option is not part of this question.", 422);
    }
    finalOptionId = optionId;
  }

  await prisma.examAnswer.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
    /* Clearing an answer is a legitimate autosave (the runner supports it). */
    create: { attemptId: attempt.id, questionId, optionId: finalOptionId },
    update: { optionId: finalOptionId, answeredAt: new Date() },
  });

  if (typeof blurCount === "number" && blurCount > attempt.blurCount) {
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { blurCount },
    });
  }

  return NextResponse.json({
    ok: true,
    data: { saved: true, questionId, hasAnswer: Boolean(finalOptionId) },
  });
}