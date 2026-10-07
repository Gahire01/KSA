import { guard } from "@/lib/api/guard";
import { examSendSchema } from "@/lib/api/exam-schemas";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { examLinkEmail } from "@/lib/email/templates";
import { appUrl, sendEmail } from "@/lib/email/send";
import { buildExamManifest } from "@/lib/exams/manifest";
import {
  OTP_TTL_MINUTES,
  generateExamToken,
  generateOtp,
  hashExamToken,
  otpExpiry,
} from "@/lib/exams/token";
import { hashSecret } from "@/lib/auth/password";
import { requestIp } from "@/lib/exams/attempt";
import { LINK_DEFAULT_HOURS, linkExpiryFromNow } from "@/lib/exams/link";
import { emit } from "@/lib/notifications/emit";

/**
 * POST /api/exams/:courseId/send
 *
 * One sitting per trainee: generate a token, freeze the shuffled manifest,
 * mint and hash an OTP, then email the link.
 *
 * Every trainee is processed independently so one bad email address does not
 * sink the whole batch — the response reports per-trainee outcomes and the UI
 * shows exactly who did not receive theirs.
 */

export async function POST(request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params;
  const gate = await guard("exam.send");
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = examSendSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const { traineeIds } = parsed.data;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      name: true,
      examDurationMin: true,
      maxAttempts: true,
      isActive: true,
      trainerId: true,
      questions: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        select: { id: true, options: { orderBy: { position: "asc" }, select: { id: true } } },
      },
    },
  });

  if (!course) return apiFail("That course does not exist.", 404);
  if (!course.isActive) return apiFail("That course is not active.", 422);
  if (course.questions.length < 1) {
    return apiFail("Add at least one question to this course before sending an exam.", 422);
  }

  const trainees = await prisma.trainee.findMany({
    where: { id: { in: traineeIds }, courseId },
    select: { id: true, fullName: true, email: true, status: true },
  });

  if (trainees.length === 0) {
    return apiFail("None of those trainees are enrolled on this course.", 422);
  }

  /* Only offer a trainee another attempt if the course allows one. */
  const priorCounts = await prisma.examAttempt.groupBy({
    by: ["traineeId"],
    where: {
      traineeId: { in: trainees.map((t) => t.id) },
      status: { in: ["SUBMITTED", "PASSED", "FAILED"] },
    },
    _count: { _all: true },
  });

  const usedMap = new Map(priorCounts.map((row) => [row.traineeId, row._count._all]));


  /* One window for the whole batch, fixed at send time. OTP stays 30 minutes. */
  const linkExpiresAt = linkExpiryFromNow(parsed.data.linkExpiresInHours ?? LINK_DEFAULT_HOURS);
  const ip = await requestIp();

  const sent: Array<{
    traineeId: string;
    name: string;
    email: string;
    url: string;
  }> = [];
  const failed: Array<{ traineeId: string; name: string; reason: string }> = [];
  const skipped: Array<{ traineeId: string; name: string; reason: string }> = [];

  for (const trainee of trainees) {
    const used = usedMap.get(trainee.id) ?? 0;

    if (used >= course.maxAttempts) {
      skipped.push({
        traineeId: trainee.id,
        name: trainee.fullName,
        reason: `All ${course.maxAttempts} attempts already used.`,
      });
      continue;
    }

    const token = generateExamToken();
    const otp = generateOtp();
    const otpHash = await hashSecret(otp);

    const manifest = buildExamManifest(
      course.id,
      course.questions.map((q) => ({ id: q.id, options: q.options })),
      token,
    );

    const attempt = await prisma.examAttempt.create({
      data: {
        tokenHash: hashExamToken(token),
        traineeId: trainee.id,
        courseId: course.id,
        otpHash,
        otpExpiresAt: otpExpiry(),
        otpAttempts: 0,
        manifest: JSON.stringify(manifest),
        status: "PENDING",
        attemptNumber: used + 1,
        durationMin: course.examDurationMin,
        linkExpiresAt,
        linkMaxUses: 1,
        linkUses: 0,
        ip,
      },
    });

    const examUrl = appUrl(`/exam/${token}`);
    const email = examLinkEmail({
      traineeName: trainee.fullName,
      courseName: course.name,
      examUrl,
      otp,
      expiryMin: OTP_TTL_MINUTES,
      durationMin: course.examDurationMin,
    });

    const result = await sendEmail({
      to: trainee.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (!result.ok) {
      /* The attempt must not linger with an undelivered code. */
      await prisma.examAttempt.delete({ where: { id: attempt.id } }).catch(() => {});
      failed.push({ traineeId: trainee.id, name: trainee.fullName, reason: result.reason ?? "Email failed." });
      continue;
    }

    sent.push({
      traineeId: trainee.id,
      name: trainee.fullName,
      email: trainee.email,
      url: examUrl,
    });
  }

  if (sent.length > 0) {
    await emit("exam.sent", {
      recipients: [{ userId: gate.session.user.id }],
      title: "Exam links sent",
      link: "/exams",
      body: `${sent.length} exam link${sent.length === 1 ? "" : "s"} sent for ${course.name}.`,
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: gate.session.user.id,
      actorEmail: gate.session.user.email,
      action: "exam.send",
      entityType: "Course",
      entityId: course.id,
      meta: JSON.stringify({
        courseName: course.name,
        sent: sent.length,
        failed: failed.length,
        skipped: skipped.length,
      }),
      ip,
    },
  });

  /* The exam URL is handed back so the owner can also deliver it over WhatsApp.
   * This is the only time the plaintext link exists outside the trainee's
   * inbox — the database only ever holds its SHA-256. */
  return apiOk(
    {
      courseId: course.id,
      courseName: course.name,
      sent: sent.map((s) => ({ ...s, url: s.url })),
      failed,
      skipped,
      summary: {
        requested: trainees.length,
        sent: sent.length,
        failed: failed.length,
        skipped: skipped.length,
      },
    },
    201,
  );
}
