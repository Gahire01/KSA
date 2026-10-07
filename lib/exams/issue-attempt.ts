import { hashSecret } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { examLinkEmail } from "@/lib/email/templates";
import { appUrl, sendEmail } from "@/lib/email/send";
import { buildExamManifest } from "@/lib/exams/manifest";
import { LINK_DEFAULT_HOURS, linkExpiryFromNow } from "@/lib/exams/link";
import {
  OTP_TTL_MINUTES,
  generateExamToken,
  generateOtp,
  hashExamToken,
  otpExpiry,
} from "@/lib/exams/token";

/**
 * Creates one sitting for a trainee (a new shuffled paper, link and code) and
 * emails it. Used for the automatic second attempt after a first fail and for the
 * owner's manual extra attempt; the bulk "send an exam" route does its own
 * channel handling and does not use this.
 *
 * The email is the only place the plaintext token ever exists, so an attempt
 * whose email fails is deleted rather than left unreachable.
 */

export type IssueAttemptResult =
  | { ok: true; attemptId: string; attemptNumber: number; url: string }
  | { ok: false; reason: string };

export async function issueAttempt(input: {
  traineeId: string;
  courseId: string;
  attemptNumber: number;
  linkHours?: number;
}): Promise<IssueAttemptResult> {
  /* Idempotent: a replayed submit must not mint a second copy of the same attempt. */
  const existing = await prisma.examAttempt.findFirst({
    where: {
      traineeId: input.traineeId,
      courseId: input.courseId,
      attemptNumber: input.attemptNumber,
      status: { in: ["PENDING", "STARTED"] },
    },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "That attempt already exists." };

  const [trainee, course] = await Promise.all([
    prisma.trainee.findUnique({
      where: { id: input.traineeId },
      select: { id: true, fullName: true, email: true },
    }),
    prisma.course.findUnique({
      where: { id: input.courseId },
      select: {
        id: true,
        name: true,
        examDurationMin: true,
        questions: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          select: { id: true, options: { orderBy: { position: "asc" }, select: { id: true } } },
        },
      },
    }),
  ]);

  if (!trainee || !course) return { ok: false, reason: "Trainee or course not found." };
  if (course.questions.length < 1) return { ok: false, reason: "The course has no questions." };

  const token = generateExamToken();
  const otp = generateOtp();

  const manifest = buildExamManifest(
    course.id,
    course.questions.map((q) => ({ id: q.id, options: q.options })),
    token,
  );

  let attempt: { id: string };
  try {
    attempt = await prisma.examAttempt.create({
      data: {
        tokenHash: hashExamToken(token),
        traineeId: trainee.id,
        courseId: course.id,
        otpHash: await hashSecret(otp),
        otpExpiresAt: otpExpiry(),
        otpAttempts: 0,
        manifest: JSON.stringify(manifest),
        status: "PENDING",
        attemptNumber: input.attemptNumber,
        durationMin: course.examDurationMin,
        linkExpiresAt: linkExpiryFromNow(input.linkHours ?? LINK_DEFAULT_HOURS),
        linkMaxUses: 1,
        linkUses: 0,
      },
      select: { id: true },
    });
  } catch (error) {
    /* The unique (trainee, course, attempt number) index: the same attempt already exists,
     * created by a concurrent call. Not an error, and not ours to duplicate. */
    if ((error as { code?: string } | null)?.code === "P2002") {
      return { ok: false, reason: "That attempt already exists." };
    }
    throw error;
  }

  const url = appUrl(`/exam/${token}`);
  const mail = examLinkEmail({
    traineeName: trainee.fullName,
    courseName: course.name,
    examUrl: url,
    otp,
    expiryMin: OTP_TTL_MINUTES,
    durationMin: course.examDurationMin,
  });

  const sent = await sendEmail({ to: trainee.email, subject: mail.subject, html: mail.html, text: mail.text });
  if (!sent.ok) {
    await prisma.examAttempt.delete({ where: { id: attempt.id } }).catch(() => {});
    return { ok: false, reason: sent.reason ?? "The email could not be sent." };
  }

  return { ok: true, attemptId: attempt.id, attemptNumber: input.attemptNumber, url };
}
