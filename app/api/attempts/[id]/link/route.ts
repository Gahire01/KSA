import { attemptLinkActionSchema } from "@/lib/api/exam-schemas";
import { guard } from "@/lib/api/guard";
import { apiFail, apiNotFound, apiOk, zodMessage } from "@/lib/api/response";
import { hashSecret } from "@/lib/auth/password";
import { viaCourse } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email/send";
import { examLinkEmail, otpCodeOnlyEmail } from "@/lib/email/templates";
import { requestIp } from "@/lib/exams/attempt";
import {
  LINK_DEFAULT_HOURS,
  LINK_EXTEND_HOURS,
  linkExpiryFromNow,
} from "@/lib/exams/link";
import {
  OTP_TTL_MINUTES,
  generateExamToken,
  generateOtp,
  hashExamToken,
  otpExpiry,
} from "@/lib/exams/token";

/**
 * POST /api/attempts/:id/link { action: "extend" | "reset" | "reissue" }
 *
 * Staff controls over an attempt's emailed link. Only a sitting that is still
 * open (PENDING or STARTED) can be touched; a finished one is history.
 *
 *  - extend   pushes the expiry out 24 hours (from now if already expired).
 *  - reset    lets the link be opened again and emails a fresh code. The
 *             original link still works (we cannot rebuild it, only its hash is
 *             stored). A paper already started keeps its original start time.
 *  - reissue  mints a new token, so the old link dies, resets the uses, and
 *             emails the new link with a fresh code. The new URL is returned
 *             once so it can also be shared over WhatsApp.
 *
 * For reset and reissue the email is sent BEFORE the row changes, so a failed
 * send leaves the attempt exactly as it was instead of locking the trainee out
 * behind a code that never arrived.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await guard("exam.send", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const body: unknown = await request.json().catch(() => null);
  const parsed = attemptLinkActionSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);
  const { action } = parsed.data;

  const attempt = await prisma.examAttempt.findFirst({
    where: { id, ...viaCourse(gate.trainerScope) },
    select: {
      id: true,
      status: true,
      tokenHash: true,
      linkExpiresAt: true,
      linkUses: true,
      firstOpenedAt: true,
      trainee: { select: { fullName: true, email: true } },
      course: { select: { name: true } },
      durationMin: true,
    },
  });
  if (!attempt) return apiNotFound("Attempt");

  if (attempt.status !== "PENDING" && attempt.status !== "STARTED") {
    return apiFail("This sitting is finished, so its link can no longer be changed.", 409);
  }

  const now = new Date();
  const ip = await requestIp();
  const audit = (name: string, meta: Record<string, unknown>) =>
    prisma.auditLog
      .create({
        data: {
          actorId: gate.session.user.id,
          actorEmail: gate.session.user.email,
          action: `exam.link.${name}`,
          entityType: "ExamAttempt",
          entityId: attempt.id,
          meta: JSON.stringify(meta),
          ip,
        },
      })
      .catch((error: unknown) => console.error("[attempt-link] audit write failed", error));

  try {
    if (action === "extend") {
      const base = attempt.linkExpiresAt && attempt.linkExpiresAt > now ? attempt.linkExpiresAt : now;
      const linkExpiresAt = new Date(base.getTime() + LINK_EXTEND_HOURS * 60 * 60 * 1000);

      const extended = await prisma.examAttempt.updateMany({
        where: { id: attempt.id, status: { in: ["PENDING", "STARTED"] } },
        data: { linkExpiresAt },
      });
      if (extended.count !== 1) return apiFail("This attempt changed while you were working. Refresh and try again.", 409);
      await audit("extend", {
        from: attempt.linkExpiresAt?.toISOString() ?? null,
        to: linkExpiresAt.toISOString(),
      });
      return apiOk({ linkExpiresAt: linkExpiresAt.toISOString() });
    }

    const otp = generateOtp();
    const otpHash = await hashSecret(otp);

    if (action === "reset") {
      const mail = otpCodeOnlyEmail({
        traineeName: attempt.trainee.fullName,
        courseName: attempt.course.name,
        otp,
        expiryMin: OTP_TTL_MINUTES,
      });
      const sent = await sendEmail({
        to: attempt.trainee.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      if (!sent.ok) {
        return apiFail("The new code could not be emailed, so nothing was changed. Try again.", 502);
      }

      /* An expired link would make the fresh code useless, so a reset revives it
       * for the standard extension window rather than mailing a dead end. */
      const expired = !attempt.linkExpiresAt || attempt.linkExpiresAt <= now;
      const reopened = await prisma.examAttempt.updateMany({
        where: { id: attempt.id, status: { in: ["PENDING", "STARTED"] } },
        data: {
          linkUses: 0,
          firstOpenedAt: null,
          firstOpenedIp: null,
          firstOpenedUa: null,
          otpHash,
          otpExpiresAt: otpExpiry(),
          otpAttempts: 0,
          ...(expired
            ? { linkExpiresAt: new Date(now.getTime() + LINK_EXTEND_HOURS * 60 * 60 * 1000) }
            : {}),
        },
      });
      if (reopened.count !== 1) return apiFail("This attempt changed while you were working. Refresh and try again.", 409);
      await audit("reset", {
        revivedExpiredLink: expired,
        usesBefore: attempt.linkUses,
        firstOpenedAtBefore: attempt.firstOpenedAt?.toISOString() ?? null,
      });
      return apiOk({ reset: true, emailed: true });
    }

    /* reissue */
    const token = generateExamToken();
    const examUrl = appUrl(`/exam/${token}`);
    const linkExpiresAt = linkExpiryFromNow(parsed.data.linkExpiresInHours ?? LINK_DEFAULT_HOURS, now);

    const mail = examLinkEmail({
      traineeName: attempt.trainee.fullName,
      courseName: attempt.course.name,
      examUrl,
      otp,
      expiryMin: OTP_TTL_MINUTES,
      durationMin: attempt.durationMin,
    });
    const sent = await sendEmail({
      to: attempt.trainee.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (!sent.ok) {
      return apiFail("The new link could not be emailed, so nothing was changed. Try again.", 502);
    }

    /* Guarded on the old hash so two staff reissuing at once cannot both win and
     * leave the trainee holding a link that was just replaced. */
    const swapped = await prisma.examAttempt.updateMany({
      where: { id: attempt.id, tokenHash: attempt.tokenHash, status: { in: ["PENDING", "STARTED"] } },
      data: {
        tokenHash: hashExamToken(token),
        linkExpiresAt,
        linkUses: 0,
        firstOpenedAt: null,
        firstOpenedIp: null,
        firstOpenedUa: null,
        otpHash,
        otpExpiresAt: otpExpiry(),
        otpAttempts: 0,
      },
    });
    if (swapped.count !== 1) {
      return apiFail("This attempt changed while you were working. Refresh and try again.", 409);
    }

    await audit("reissue", { linkExpiresAt: linkExpiresAt.toISOString(), usesBefore: attempt.linkUses });
    return apiOk(
      { reissued: true, emailed: true, url: examUrl, linkExpiresAt: linkExpiresAt.toISOString() },
      200,
      { "Cache-Control": "no-store" },
    );
  } catch (error) {
    return apiFail("Could not update the link. Try again.", 500, { logError: error });
  }
}
