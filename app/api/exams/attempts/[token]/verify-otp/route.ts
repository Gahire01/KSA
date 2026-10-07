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
import { LINK_EXPIRED_MESSAGE, LINK_USED_MESSAGE, linkState } from "@/lib/exams/link";
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

  /* An unknown token is indistinguishable from a wrong code. */
  if (!attempt) return apiFail(GENERIC, 401);

  /* Link lifecycle, checked before the code so a dead link never reaches the
   * hash comparison. The token is 32 random bytes, so only its holder can see
   * these two messages; they say nothing beyond "expired" or "already opened". */
  const now = new Date();
  const finished =
    attempt.status === "SUBMITTED" ||
    attempt.status === "PASSED" ||
    attempt.status === "FAILED" ||
    attempt.status === "VOID";
  const state = linkState(attempt, now);
  if (state === "expired") return apiFail(LINK_EXPIRED_MESSAGE, 410);
  if (finished) return apiFail(LINK_USED_MESSAGE, 410);

  if (state === "used") {
    /* The trainee's own tab already holds the cookie: tell it, don't block it. */
    if (attempt.status === "STARTED" && (await readExamSession(token, attempt.id))) {
      return apiFail("This exam is already open on this device.", 409);
    }
    return apiFail(LINK_USED_MESSAGE, 410);
  }

  /* A started paper with uses left means staff reset the link; the cleared code
   * hash means there is nothing to verify until they issue a fresh one. */
  if (!attempt.otpHash || attempt.otpExpiresAt <= now) {
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

  const ip = await requestIp();
  const userAgent = await requestUserAgent();

  /* Redeem the link atomically. `linkUses` is matched against the value read
   * above, so two requests racing with the same correct code cannot both win:
   * the loser updates zero rows and is told the link is used. A resumed paper
   * (staff reset the link) keeps its original start time, so the server clock
   * on the sitting is never restarted by a re-open. */
  const startedAt = attempt.startedAt ?? now;
  const redeemed = await prisma.examAttempt.updateMany({
    where: { id: attempt.id, linkUses: attempt.linkUses },
    data: {
      status: "STARTED",
      startedAt,
      linkUses: { increment: 1 },
      firstOpenedAt: attempt.firstOpenedAt ?? now,
      firstOpenedIp: attempt.firstOpenedIp ?? ip,
      firstOpenedUa: attempt.firstOpenedUa ?? userAgent,
      ip: attempt.ip ?? ip,
      userAgent: attempt.userAgent ?? userAgent,
      /* The hash is cleared so a correct code cannot be replayed. */
      otpHash: "",
    },
  });
  if (redeemed.count !== 1) return apiFail(LINK_USED_MESSAGE, 410);

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
      startedAt: startedAt.toISOString(),
      linkExpiresAt: attempt.linkExpiresAt?.toISOString() ?? null,
    },
  });
}
