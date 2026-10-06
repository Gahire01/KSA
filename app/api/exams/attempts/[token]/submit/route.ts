import { NextResponse } from "next/server";

import { examSubmitSchema } from "@/lib/api/exam-schemas";
import { apiFail, zodMessage } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { loadAttemptByToken, manifestOf, requestIp, requestUserAgent } from "@/lib/exams/attempt";
import { clearExamSessionCookie, readExamSession } from "@/lib/exams/session-cookie";
import { issueCertificate } from "@/lib/certificates/issue";
import { emit, ownerAndTrainerIds } from "@/lib/notifications/emit";

/**
 * POST /api/exams/attempts/:token/submit
 *
 * Grades the paper once, server-side, and issues a certificate on a pass.
 *
 * Grading is authoritative: `isCorrect` comes from the QuestionOption rows, not
 * from anything the client sent. The response reports the score and the outcome
 * only — never which questions were right or which option was correct, because
 * that would let a trainee use a retake to extract the answer key.
 */

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const attempt = await loadAttemptByToken(token);
  if (!attempt) return apiFail("This exam link is not valid.", 404);

  /* Idempotent-ish: a second submit reports the recorded result rather than
   * regrading, so a double-tapped submit button cannot change the outcome. */
  if (attempt.status !== "STARTED") {
    if (attempt.status === "SUBMITTED" || attempt.status === "PASSED" || attempt.status === "FAILED") {
      /* Self-healing. Certificate allocation can fail — a student-number clash that
       * outlasts the retry, or a process death between the attempt status write and
       * the certificate insert — and the attempt is already PASSED, so nothing else
       * would ever retry it and the trainee would be permanently without their
       * certificate. Re-running submit repairs that. `issueCertificate` returns the
       * existing row without re-sending the email when one is already there, so this
       * is safe to call unconditionally on a replay. */
      const certificate =
        attempt.status === "PASSED"
          ? await issueCertificate({
              traineeId: attempt.traineeId,
              courseId: attempt.courseId,
              attemptId: attempt.id,
            })
          : null;

      return NextResponse.json({
        ok: true,
        data: {
          alreadySubmitted: true,
          status: attempt.status,
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
      });
    }
    return apiFail("This exam is not open.", 410);
  }

  if (!(await readExamSession(token, attempt.id))) {
    return apiFail("Enter the code we emailed you to open this exam.", 401);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = examSubmitSchema.safeParse(body ?? {});
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const manifest = manifestOf(attempt);
  if (!manifest) return apiFail("This exam paper could not be read.", 500);

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
  const passed = totalCount > 0 && scorePct >= passMarkPct;

  const now = new Date();
  const ip = await requestIp();
  const userAgent = await requestUserAgent();

  /* Second failure exhausts the course's attempts, so the enrolment is closed
   * as FAILED rather than left pending forever. */
  const exhausted = !passed && attempt.attemptNumber >= attempt.course.maxAttempts;

  const status = passed ? "PASSED" : exhausted ? "FAILED" : "SUBMITTED";

  await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      status,
      submittedAt: now,
      scorePct,
      correctCount,
      totalCount,
      blurCount: parsed.data.blurCount ?? attempt.blurCount,
      ip: attempt.ip ?? ip,
      userAgent: attempt.userAgent ?? userAgent,
      otpHash: "",
    },
  });

  if (passed || exhausted) {
    await prisma.trainee.update({
      where: { id: attempt.traineeId },
      data: { status: passed ? "COMPLETED" : "FAILED" },
    });
  }

  /* The exam-session cookie is cleared so the token cannot be driven further. */
  await clearExamSessionCookie(token);

  let certificate: {
    id: string;
    studentNumber: number;
    verificationToken: string;
    issuedAt: string;
  } | null = null;

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
       * silently: log loudly and let the replay path above repair it on the next
       * submit rather than leaving a silent hole in the compliance record. */
      console.error(
        `[certificates] allocation failed for attempt ${attempt.id} (trainee ${attempt.traineeId}, course ${attempt.courseId}); ` +
          "the attempt is PASSED with no certificate and must be re-issued",
      );
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
      title: "Exam not passed",
      link: "/exams",
      body: `${who} scored ${scorePct}% on ${attempt.course.name}, below the ${passMarkPct}% pass mark.`,
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: null,
      actorEmail: attempt.trainee.email,
      action: "exam.submit",
      entityType: "ExamAttempt",
      entityId: attempt.id,
      meta: JSON.stringify({ courseId: attempt.courseId, scorePct, passed, status }),
      ip,
      userAgent,
    },
  });

  return NextResponse.json({
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
      certificate,
    },
  });
}