import { guard } from "@/lib/api/guard";
import { examSendSchema } from "@/lib/api/exam-schemas";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { ownsCourse } from "@/lib/auth/scope";
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
import {
  examWhatsappMessage,
  lookupWhatsapp,
  normalizeE164,
  sendWhatsapp,
  whatsappConfigured,
} from "@/lib/whatsapp/twilio";

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
  const gate = await guard("exam.send", { trainerScoped: true });
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

  /* A trainer can only send exams for their own courses. */
  if (!course || !ownsCourse(gate.trainerScope, course)) return apiFail("That course does not exist.", 404);
  if (!course.isActive) return apiFail("That course is not active.", 422);
  if (course.questions.length < 1) {
    return apiFail("Add at least one question to this course before sending an exam.", 422);
  }

  const trainees = await prisma.trainee.findMany({
    where: { id: { in: traineeIds }, courseId },
    select: { id: true, fullName: true, email: true, phone: true, countryCode: true, status: true },
  });

  if (trainees.length === 0) {
    return apiFail("None of those trainees are enrolled on this course.", 422);
  }

  /* What each trainee has already done on THIS course, so a send can't hand out more
   * sittings than the course allows, a second one on top of a link that is still open
   * (the failed first attempt emails attempt 2 by itself), or one to someone who passed. */
  const history = await prisma.examAttempt.findMany({
    where: { traineeId: { in: trainees.map((t) => t.id) }, courseId },
    select: { traineeId: true, status: true, attemptNumber: true },
  });

  const summary = new Map<
    string,
    { used: number; passed: boolean; open: boolean; lastNumber: number }
  >();
  for (const row of history) {
    const s = summary.get(row.traineeId) ?? { used: 0, passed: false, open: false, lastNumber: 0 };
    if (row.status === "SUBMITTED" || row.status === "PASSED" || row.status === "FAILED") s.used += 1;
    if (row.status === "PASSED") s.passed = true;
    if (row.status === "PENDING" || row.status === "STARTED") s.open = true;
    s.lastNumber = Math.max(s.lastNumber, row.attemptNumber);
    summary.set(row.traineeId, s);
  }


  /* One window for the whole batch, fixed at send time. OTP stays 30 minutes. */
  const linkExpiresAt = linkExpiryFromNow(parsed.data.linkExpiresInHours ?? LINK_DEFAULT_HOURS);
  const ip = await requestIp();

  /* Channels. WhatsApp that is requested but not configured degrades to email
   * with a notice instead of failing the batch. */
  const { channel, verifyWhatsapp } = parsed.data;
  const waConfigured = whatsappConfigured();
  const notices: string[] = [];
  if (channel !== "email" && !waConfigured) {
    notices.push("WhatsApp not configured — sending email only");
    console.warn("[exam-send] WhatsApp requested but Twilio is not configured");
  }
  const useWhatsapp = channel !== "email" && waConfigured;
  const useEmail = channel !== "whatsapp" || !waConfigured;

  const sent: Array<{
    traineeId: string;
    name: string;
    email: string;
    url: string;
    delivered: { email: boolean; whatsapp: boolean };
    whatsappNote: string | null;
  }> = [];
  const failed: Array<{ traineeId: string; name: string; reason: string }> = [];
  const skipped: Array<{ traineeId: string; name: string; reason: string }> = [];

  for (const trainee of trainees) {
    const past = summary.get(trainee.id) ?? { used: 0, passed: false, open: false, lastNumber: 0 };

    if (past.passed) {
      skipped.push({ traineeId: trainee.id, name: trainee.fullName, reason: "Already passed this course." });
      continue;
    }

    if (past.open) {
      skipped.push({
        traineeId: trainee.id,
        name: trainee.fullName,
        reason: "Already has an open exam link. Reissue that attempt instead of sending another.",
      });
      continue;
    }

    if (past.used >= course.maxAttempts) {
      skipped.push({
        traineeId: trainee.id,
        name: trainee.fullName,
        reason: `All ${course.maxAttempts} attempts already used.`,
      });
      continue;
    }

    /* Decide the channels BEFORE minting anything, so a trainee who cannot be
     * reached at all never gets an orphan attempt. */
    let phone: string | null = null;
    let whatsappNote: string | null = null;
    if (useWhatsapp) {
      phone = normalizeE164(trainee.phone, trainee.countryCode);
      if (!phone) {
        whatsappNote = "No valid WhatsApp number on file.";
      } else if (verifyWhatsapp) {
        const check = await lookupWhatsapp(phone);
        if (check === "no" || check === "invalid") {
          phone = null;
          whatsappNote = check === "no" ? "That number is not on WhatsApp." : "That number is not valid.";
        }
      }
    }
    if (!useEmail && !phone) {
      skipped.push({
        traineeId: trainee.id,
        name: trainee.fullName,
        reason: whatsappNote ?? "No way to reach this trainee.",
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

    let attempt: { id: string };
    try {
      attempt = await prisma.examAttempt.create({
        data: {
          tokenHash: hashExamToken(token),
          traineeId: trainee.id,
          courseId: course.id,
          otpHash,
          otpExpiresAt: otpExpiry(),
          otpAttempts: 0,
          manifest: JSON.stringify(manifest),
          status: "PENDING",
          attemptNumber: past.lastNumber + 1,
          durationMin: course.examDurationMin,
          linkExpiresAt,
          linkMaxUses: 1,
          linkUses: 0,
          ip,
        },
        select: { id: true },
      });
    } catch (error) {
      /* The unique (trainee, course, attempt number) index: another send or the automatic
       * second attempt got there first. That is a skip, not a failure. */
      if ((error as { code?: string } | null)?.code === "P2002") {
        skipped.push({
          traineeId: trainee.id,
          name: trainee.fullName,
          reason: "An exam was sent to this trainee a moment ago.",
        });
        continue;
      }
      throw error;
    }

    const examUrl = appUrl(`/exam/${token}`);
    const email = examLinkEmail({
      traineeName: trainee.fullName,
      courseName: course.name,
      examUrl,
      otp,
      expiryMin: OTP_TTL_MINUTES,
      durationMin: course.examDurationMin,
    });

    const delivered = { email: false, whatsapp: false };
    const problems: string[] = [];

    if (useEmail) {
      const result = await sendEmail({
        to: trainee.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      delivered.email = result.ok;
      if (!result.ok) problems.push(result.reason ?? "Email failed.");
    }

    if (phone) {
      const wa = await sendWhatsapp(
        phone,
        examWhatsappMessage({
          firstName: trainee.fullName.trim().split(/\s+/)[0] ?? trainee.fullName,
          courseName: course.name,
          otp,
          examUrl,
          expiryMin: OTP_TTL_MINUTES,
        }),
      );
      delivered.whatsapp = wa.ok;
      if (!wa.ok) {
        whatsappNote = wa.reason ?? "WhatsApp failed.";
        problems.push(whatsappNote);
      }
    }

    if (!delivered.email && !delivered.whatsapp) {
      /* The attempt must not linger with an undelivered code. */
      await prisma.examAttempt.delete({ where: { id: attempt.id } }).catch(() => {});
      failed.push({
        traineeId: trainee.id,
        name: trainee.fullName,
        reason: problems.join(" ") || whatsappNote || "Could not be delivered.",
      });
      continue;
    }

    sent.push({
      traineeId: trainee.id,
      name: trainee.fullName,
      email: trainee.email,
      url: examUrl,
      delivered,
      whatsappNote,
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
        notices,
        sent: sent.length,
        failed: failed.length,
        skipped: skipped.length,
      },
    },
    201,
  );
}
