import { NextResponse } from "next/server";

import {
  OTP_RESEND_LIMIT,
  OTP_VERIFY_LIMIT,
  clientKey,
  rateLimit,
  rateLimitFail,
} from "@/lib/api/rate-limit";
import { apiFail } from "@/lib/api/response";
import { hashSecret } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { otpResentEmail } from "@/lib/email/templates";
import { appUrl, sendEmail } from "@/lib/email/send";
import { loadAttemptByToken, manifestOf } from "@/lib/exams/attempt";
import { LINK_EXPIRED_MESSAGE, LINK_USED_MESSAGE, linkState } from "@/lib/exams/link";
import { OTP_TTL_MINUTES, generateOtp, otpExpiry } from "@/lib/exams/token";

/**
 * POST /api/exams/attempts/:token/resend-otp
 *
 * Issues a fresh code. Capped at 3 per token per hour so the endpoint cannot be
 * used to mail-bomb a trainee or to grind a code through the mail provider's
 * own quota.
 *
 * The attempt's manifest and token are untouched — only the OTP hash, its expiry
 * and the attempt counter change, so a mid-exam resend cannot reset the timer.
 */

/** Same generic message as verify-otp, for the same anti-probing reason. */
const GENERIC = "Invalid or expired code";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const resend = rateLimit(
    `otp-resend:token:${token}`,
    OTP_RESEND_LIMIT.perToken,
    OTP_RESEND_LIMIT.windowMs,
  );
  if (!resend.ok) return rateLimitFail(resend.retryAfterSeconds);

  /* Shares the verify IP bucket so the two cannot be used to double the guesses
   * allowed against a single address. */
  const perIp = rateLimit(
    clientKey(request, "otp-verify:ip"),
    OTP_VERIFY_LIMIT.perIp,
    OTP_VERIFY_LIMIT.windowMs,
  );
  if (!perIp.ok) return rateLimitFail(perIp.retryAfterSeconds);

  const attempt = await loadAttemptByToken(token);

  if (
    !attempt ||
    attempt.status === "SUBMITTED" ||
    attempt.status === "PASSED" ||
    attempt.status === "FAILED" ||
    attempt.status === "VOID" ||
    attempt.status === "STARTED"
  ) {
    return apiFail(GENERIC, 401);
  }

  /* A dead link gets no new code: mailing one would only invite a failed open. */
  if (linkState(attempt) === "expired") return apiFail(LINK_EXPIRED_MESSAGE, 410);
  if (linkState(attempt) === "used") return apiFail(LINK_USED_MESSAGE, 410);

  if (!manifestOf(attempt)) {
    return apiFail("This exam paper could not be read. Ask the academy for help.", 500);
  }

  const otp = generateOtp();

  await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      otpHash: await hashSecret(otp),
      otpExpiresAt: otpExpiry(),
      otpAttempts: 0,
    },
  });

  const email = otpResentEmail({
    traineeName: attempt.trainee.fullName,
    courseName: attempt.course.name,
    examUrl: appUrl(`/exam/${token}`),
    otp,
    expiryMin: OTP_TTL_MINUTES,
  });

  const result = await sendEmail({
    to: attempt.trainee.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (!result.ok) {
    /* The old hash is already replaced. Tell the trainee to try again rather
     * than claiming a code was sent. */
    return apiFail("We could not send a new code. Try again in a minute.", 502);
  }

  return NextResponse.json({
    ok: true,
    data: {
      sent: true,
      expiresInMin: OTP_TTL_MINUTES,
    },
  });
}
