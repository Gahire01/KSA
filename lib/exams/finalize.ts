import { prisma } from "@/lib/db";
import { issueCertificate } from "@/lib/certificates/issue";
import {
  type LoadedAttempt,
  manifestOf,
  requestIp,
  requestUserAgent,
  secondsPastDeadline,
} from "@/lib/exams/attempt";
import { appendIntegrityFlag } from "@/lib/exams/flags";
import { issueAttempt } from "@/lib/exams/issue-attempt";
import { clearExamSessionCookie } from "@/lib/exams/session-cookie";
import { emit, ownerAndTrainerIds } from "@/lib/notifications/emit";

/**
 * Grades and closes one sitting. Shared by the trainee's own submit and by the
 * server-side auto-submit (too many focus losses), so both take the same path.
 *
 * Grading is authoritative: `isCorrect` comes from the QuestionOption rows, not
 * from anything the client sent, and the result never says which questions were
 * right or which option was correct (a retake must not extract the answer key).
 */

/** An answer or submit may arrive this long after the paper's clock reaches zero. */
export const SUBMIT_GRACE_SECONDS = 30;

export type FinalizeResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

/**
 * The recorded outcome of an attempt that is already closed. Also repairs a
 * PASSED attempt that somehow has no certificate (a student-number clash that
 * outlasted the retry, or a process death between the status write and the
 * insert): `issueCertificate` returns the existing row without re-sending the
 * email when one is already there, so this is safe to call on every replay.
 */
export async function recordedResult(attempt: LoadedAttempt): Promise<FinalizeResult> {
  const certificate =
    attempt.status === "PASSED"
      ? await issueCertificate({
          traineeId: attempt.traineeId,
          courseId: attempt.courseId,
          attemptId: attempt.id,
        })
      : null;

  const maxAttempts = attempt.course.maxAttempts;

  return {
    ok: true,
    data: {
      alreadySubmitted: true,
      status: attempt.status,
      /* The same shape as a first-time result, so the screen renders a replayed or
       * raced submit exactly as it would the original (a PASSED trainee must not be
       * shown "Not passed" because `passed` came back undefined). */
      passed: attempt.status === "PASSED",
      exhausted: attempt.status === "FAILED",
      attemptNumber: attempt.attemptNumber,
      maxAttempts,
      attemptsRemaining: Math.max(0, maxAttempts - attempt.attemptNumber),
      scorePct: attempt.scorePct,
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
      passMarkPct: attempt.course.passMarkPct,
      certificate: certificate
        ? {
            id: certificate.certificate.id,
            studentNumber: certificate.certificate.studentNumber,
            verificationToken: certificate.certificate.verificationToken,
            issuedAt: certificate.certificate.issuedAt.toISOString(),
          }
        : null,
    },
  };
}

export async function finalizeAttempt(
  attempt: LoadedAttempt,
  options: { token: string; autoFlag?: "too_many_blurs" },
): Promise<FinalizeResult> {
  const manifest = manifestOf(attempt);
  if (!manifest) return { ok: false, status: 500, error: "This exam paper could not be read." };

  const questionIds = manifest.questionIds;

  /* The answer key is read only here, server-side, and never leaves this file. */
  const correctOptions = await prisma.questionOption.findMany({
    where: { questionId: { in: questionIds }, isCorrect: true },
    select: { questionId: true, id: true },
  });
  const correctByQuestion = new Map(correctOptions.map((o) => [o.questionId, o.id]));

  const saved = await prisma.examAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, optionId: true },
  });
  const chosenByQuestion = new Map(saved.map((a) => [a.questionId, a.optionId]));

  let correctCount = 0;
  for (const questionId of questionIds) {
    const chosen = chosenByQuestion.get(questionId) ?? null;
    const correctId = correctByQuestion.get(questionId) ?? null;
    const isCorrect = Boolean(chosen && correctId && chosen === correctId);
    if (isCorrect) correctCount += 1;

    /* Unanswered questions get an explicit false row so the register shows a
     * complete mark sheet rather than missing entries. */
    await prisma.examAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
      create: { attemptId: attempt.id, questionId, optionId: null, isCorrect: false },
      update: { isCorrect },
    });
  }

  const totalCount = questionIds.length;
  const scorePct = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100);
  const passMarkPct = attempt.course.passMarkPct;
  /* Compared exactly, not on the rounded percentage: 99 of 200 is 49.5% and must not
   * round up into a pass on a 50% mark. */
  const passed = totalCount > 0 && correctCount * 100 >= passMarkPct * totalCount;

  /* Running out of attempts closes the enrolment as FAILED rather than leaving it
   * pending forever. An owner-granted extra attempt works the same way. */
  const exhausted = !passed && attempt.attemptNumber >= attempt.course.maxAttempts;
  const status = passed ? "PASSED" : exhausted ? "FAILED" : "SUBMITTED";

  const now = new Date();
  const ip = await requestIp();
  const userAgent = await requestUserAgent();

  /* Only a STARTED attempt can be closed, and only once: if a submit and a
   * server auto-submit race, the loser updates zero rows and reports the
   * recorded result instead of grading and emailing twice. */
  const closed = await prisma.examAttempt.updateMany({
    where: { id: attempt.id, status: "STARTED" },
    data: {
      status,
      submittedAt: now,
      scorePct,
      correctCount,
      totalCount,
      /* blurCount is not touched here: it is the server's own running count, and the row
       * loaded above may already be stale by the flag that triggered this auto-submit. */
      ip: attempt.ip ?? ip,
      userAgent: attempt.userAgent ?? userAgent,
      otpHash: "",
    },
  });

  if (closed.count !== 1) {
    const fresh = await prisma.examAttempt.findUnique({
      where: { id: attempt.id },
      include: { trainee: { select: { id: true, fullName: true, email: true } }, course: true },
    });
    if (fresh && fresh.status !== "STARTED") {
      return recordedResult(fresh as unknown as LoadedAttempt);
    }
    return { ok: false, status: 409, error: "This exam could not be submitted. Try again." };
  }

  /* Flags that explain how the sitting ended. */
  if (secondsPastDeadline(attempt) > SUBMIT_GRACE_SECONDS) {
    await appendIntegrityFlag(attempt.id, "late_submit").catch(() => undefined);
  }
  if (options.autoFlag) {
    await appendIntegrityFlag(attempt.id, options.autoFlag).catch(() => undefined);
  }

  if (passed || exhausted) {
    await prisma.trainee.update({
      where: { id: attempt.traineeId },
      data: { status: passed ? "COMPLETED" : "FAILED" },
    });
  }

  /* The exam-session cookie is cleared so the token cannot be driven further. */
  await clearExamSessionCookie(options.token);

  let certificate: { id: string; studentNumber: number; verificationToken: string; issuedAt: string } | null = null;

  if (passed) {
    const issued = await issueCertificate({
      traineeId: attempt.traineeId,
      courseId: attempt.courseId,
      attemptId: attempt.id,
    });
    if (issued) {
      certificate = {
        id: issued.certificate.id,
        studentNumber: issued.certificate.studentNumber,
        verificationToken: issued.certificate.verificationToken,
        issuedAt: issued.certificate.issuedAt.toISOString(),
      };
    } else {
      /* The trainee is now COMPLETED with no certificate. This must not pass
       * silently: log loudly and let the replay path repair it on the next submit. */
      console.error(
        `[certificates] allocation failed for attempt ${attempt.id} (trainee ${attempt.traineeId}, course ${attempt.courseId}); ` +
          "the attempt is PASSED with no certificate and must be re-issued",
      );
    }
  }

  /* Failed with an attempt left: a new shuffled paper, link and code go out by
   * email automatically. If that email cannot be sent the staff are told, and the
   * normal "Send an exam" flow can issue it by hand. */
  let nextAttempt: { emailed: boolean } | null = null;
  if (!passed && !exhausted) {
    const next = await issueAttempt({
      traineeId: attempt.traineeId,
      courseId: attempt.courseId,
      attemptNumber: attempt.attemptNumber + 1,
    });
    nextAttempt = { emailed: next.ok };
    if (!next.ok) {
      console.error(`[exam] next attempt not issued for trainee ${attempt.traineeId}: ${next.reason}`);
    }
  }

  const audience = await ownerAndTrainerIds(attempt.courseId);
  const who = attempt.trainee.fullName;
  const toAudience = audience.map((userId) => ({ userId }));

  await emit("exam.submitted", {
    recipients: toAudience,
    title: "Exam submitted",
    link: "/exams",
    body: `${who} submitted ${attempt.course.name} with ${scorePct}% (attempt ${attempt.attemptNumber} of ${attempt.course.maxAttempts}).`,
  });

  if (passed) {
    await emit("exam.passed", {
      recipients: toAudience,
      title: "Exam passed",
      link: "/certificates",
      body: `${who} passed ${attempt.course.name} with ${scorePct}%.${
        certificate ? ` Certificate #${certificate.studentNumber} issued.` : ""
      }`,
    });
    if (certificate) {
      await emit("certificate.issued", {
        recipients: toAudience,
        title: "Certificate issued",
        link: "/certificates",
        body: `Certificate #${certificate.studentNumber} issued to ${who} for ${attempt.course.name}.`,
      });
    }
  } else if (exhausted) {
    await emit("exam.failed", {
      recipients: toAudience,
      title: "No attempts remaining",
      link: "/trainees",
      body: `${who} used all ${attempt.course.maxAttempts} attempts on ${attempt.course.name} without passing (${scorePct}%).`,
    });
  } else {
    await emit("exam.failed", {
      recipients: toAudience,
      title: nextAttempt?.emailed === false ? "Exam not passed: send the next attempt by hand" : "Exam not passed",
      link: "/exams",
      body:
        `${who} scored ${scorePct}% on ${attempt.course.name}, below the ${passMarkPct}% pass mark.` +
        (nextAttempt?.emailed === false ? " The automatic second-attempt email could not be sent." : ""),
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: null,
      actorEmail: attempt.trainee.email,
      action: "exam.submit",
      entityType: "ExamAttempt",
      entityId: attempt.id,
      meta: JSON.stringify({
        courseId: attempt.courseId,
        scorePct,
        passed,
        status,
        auto: options.autoFlag ?? null,
      }),
      ip,
      userAgent,
    },
  });

  return {
    ok: true,
    data: {
      status,
      passed,
      scorePct,
      /* Counts are the trainee's own result and reveal nothing about the key. */
      correctCount,
      totalCount,
      passMarkPct,
      attemptNumber: attempt.attemptNumber,
      maxAttempts: attempt.course.maxAttempts,
      attemptsRemaining: Math.max(0, attempt.course.maxAttempts - attempt.attemptNumber),
      exhausted,
      nextAttempt,
      certificate,
    },
  };
}
