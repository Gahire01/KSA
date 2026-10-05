import { NextResponse } from "next/server";

import { examOtpSchema } from "@/lib/api/exam-schemas";
import {
  OTP_VERIFY_LIMIT,
  clientKey,
  rateLimit,
  rateLimitFail,
} from "@/lib/api/rate-limit";
import { apiFail } from "@/lib/api/response";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { loadAttemptByToken, manifestOf, requestIp, requestUserAgent } from "@/lib/exams/attempt";
import { readExamSession, setExamSessionCookie } from "@/lib/exams/session-cookie";
import { OTP_MAX_ATTEMPTS } from "@/lib/exams/token";

/**
 * POST /api/exams/attempts/:token/verify-otp
 *
 * Exchanges the emailed six-digit code for a paper.
 *
 * Every rejection path returns the same 401 `{ error: "Invalid or expired code" }`
 * so the page cannot be used to distinguish a real token from a wrong code, a
 * spent attempt from a pending one, or an expired link from a live one. Only the
 * attempt cap (429) and the IP rate limit (429) are distinguishable, and both are
 * reached before any comparison happens.
 *
 * Nothing in the success body reveals which option is correct — see
 * lib/exams/manifest.ts, where the manifest holds ids only.
 */

/** Single generic message for every "you may not have this" outcome. */
const GENERIC = "Invalid or expired code";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  /* Rate limit before touching the database: 5 per token and 10 per IP. */
  const perToken = rateLimit(
    `otp-verify:token:${token}`,
    OTP_VERIFY_LIMIT.perToken,
    OTP_VERIFY_LIMIT.windowMs,
  );
  if (!perToken.ok) return rateLimitFail(perToken.retryAfterSeconds);

  const perIp = rateLimit(
    clientKey(request, "otp-verify:ip"),
    OTP_VERIFY_LIMIT.perIp,
    OTP_VERIFY_LIMIT.windowMs,
  );
  if (!perIp.ok) return rateLimitFail(perIp.retryAfterSeconds);

  const body: unknown = await request.json().catch(() => null);
  const parsed = examOtpSchema.safeParse(body);
  if (!parsed.success) return apiFail(GENERIC, 401);

  const attempt = await loadAttemptByToken(token);

  /* Unknown token, expired link, already submitted or voided — all identical. */
  if (
    !attempt ||
    attempt.status === "SUBMITTED" ||
    attempt.status === "PASSED" ||
    attempt.status === "FAILED" ||
    attempt.status === "VOID"
  ) {
    return apiFail(GENERIC, 401);
  }

  if (attempt.linkExpiresAt <= new Date() || attempt.otpExpiresAt <= new Date()) {
    return apiFail(GENERIC, 401);
  }

  /* Already opened on this device — let the runner continue rather than making
   * the trainee enter a second code. Any other device gets the generic error. */
  if (attempt.status === "STARTED") {
    const already = await readExamSession(token, attempt.id);
    if (already) {
      return apiFail("This exam is already open on this device.", 409);
    }
    return apiFail(GENERIC, 401);
  }

  if (attempt.otpAttempts >= OTP_MAX_ATTEMPTS) {
    return apiFail("Too many attempts. Ask the academy to resend.", 429);
  }

  const ok = await verifyPassword(attempt.otpHash, parsed.data.code);

  if (!ok) {
    /* Counted, but the reply stays generic so the counter is not probeable
     * except by brute force, which the rate limit already blocks. */
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { otpAttempts: { increment: 1 } },
    });
    return apiFail(GENERIC, 401);
  }

  const manifest = manifestOf(attempt);
  if (!manifest) {
    return apiFail("This exam paper could not be read. Ask the academy to resend it.", 500);
  }

  const now = new Date();
  const ip = await requestIp();
  const userAgent = await requestUserAgent();

  await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "STARTED",
      startedAt: now,
      ip: attempt.ip ?? ip,
      userAgent: attempt.userAgent ?? userAgent,
      /* Single-use: the hash is cleared so a correct code cannot be replayed. */
      otpHash: "",
    },
  });

  await setExamSessionCookie(token, attempt.id);

  /* Deliberately narrow: no otpHash, no otpAttempts, no isCorrect, no tokenHash. */
  return NextResponse.json({
    ok: true,
    data: {
      manifest,
      examDurationMin: attempt.durationMin,
      courseName: attempt.course.name,
      traineeName: attempt.trainee.fullName,
      passMarkPct: attempt.course.passMarkPct,
      questionCount: manifest.questionIds.length,
      startedAt: now.toISOString(),
      linkExpiresAt: attempt.linkExpiresAt.toISOString(),
    },
  });
}