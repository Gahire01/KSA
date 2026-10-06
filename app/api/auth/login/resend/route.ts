import { randomInt } from "node:crypto";
import type { NextRequest } from "next/server";

import { LOGIN_RESEND_LIMIT, rateLimit } from "@/lib/api/rate-limit";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { loginResendSchema } from "@/lib/api/schemas";
import { hashSecret } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { OTP_EXPIRY_MINUTES, sendLoginOtpEmail } from "@/lib/email/templates";

/** Silence between two mails to the same inbox, enforced on the row itself so
 *  it holds across restarts and cannot be reset from the client. */
const RESEND_COOLDOWN_MS = 60_000;

function minutesFrom(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * POST /api/auth/login/resend — mails a fresh code for the same sign-in.
 *
 * The answer is `{ ok: true }` whether or not anything was sent: an unknown
 * address, a sign-in with no code outstanding and a cooldown hit are all
 * reported identically, so this endpoint cannot be used to probe for accounts
 * or to work out when somebody else is signing in.
 */
export async function POST(request: NextRequest) {
  const raw: unknown = await request.json().catch(() => null);
  const parsed = loginResendSchema.safeParse(raw);

  if (!parsed.success) {
    return apiFail(zodMessage(parsed.error), 400);
  }

  const email = parsed.data.email.trim().toLowerCase();

  const limitKey = `login-resend:${email}`;
  const limit = rateLimit(limitKey, LOGIN_RESEND_LIMIT.perEmail, LOGIN_RESEND_LIMIT.windowMs);
  if (!limit.ok) {
    const response = apiFail(
      `Too many codes requested for this account. Try again in ${minutesFrom(limit.retryAfterSeconds)} minute(s).`,
      429,
    );
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return response;
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return apiOk({ sent: false });

  const otp = await prisma.loginOtp.findFirst({ where: { userId: user.id } });
  if (!otp) return apiOk({ sent: false });

  /* 60-second cooldown: a double click, a impatient retry or a mail client
   * that swallowed the first one all land here and hear "ok" without a second
   * message going out. */
  if (Date.now() - otp.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return apiOk({ sent: false });
  }

  const code = randomInt(100000, 999999).toString().padStart(6, "0");
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

  const previous = {
    codeHash: otp.codeHash,
    expiresAt: otp.expiresAt,
    attempts: otp.attempts,
    lastSentAt: otp.lastSentAt,
  };

  await prisma.loginOtp.update({
    where: { id: otp.id },
    data: {
      codeHash,
      expiresAt,
      attempts: 0,
      resendCount: { increment: 1 },
      lastSentAt: new Date(),
    },
  });

  try {
    await sendLoginOtpEmail({
      code,
      expiryMinutes: OTP_EXPIRY_MINUTES,
      recipientEmail: email,
    });
  } catch (error) {
    /* The new code never left the building, so the old one is put back rather
     * than leaving the account with no working code at all — and the cooldown
     * clock is rewound, so an immediate retry is not silently swallowed. */
    await prisma.loginOtp
      .update({
        where: { id: otp.id },
        data: {
          codeHash: previous.codeHash,
          expiresAt: previous.expiresAt,
          attempts: previous.attempts,
          lastSentAt: previous.lastSentAt,
          resendCount: { decrement: 1 },
        },
      })
      .catch(() => {});
    console.error("[login-otp] resend email failed", error);
    return apiFail("Could not send code. Try again in a moment.", 500);
  }

  return apiOk({ sent: true });
}
