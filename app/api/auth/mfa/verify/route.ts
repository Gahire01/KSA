import type { NextRequest } from "next/server";

import { MFA_LIMIT, rateLimit } from "@/lib/api/rate-limit";
import { guardPendingSession } from "@/lib/api/guard";
import { apiFail, apiOk } from "@/lib/api/response";
import { recoveryCodeSchema, totpCodeSchema } from "@/lib/api/schemas";
import { markSessionMfaPassed } from "@/lib/auth/session";
import { checkRecoveryCode, verifyTotp } from "@/lib/auth/totp";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/mfa/verify
 *
 * Second step of every sign-in. Accepts either a live TOTP code or an unused
 * recovery code; recovery codes are single-use and marked consumed here.
 */
export async function POST(request: NextRequest) {
  const gate = await guardPendingSession();
  if (!gate.ok) return gate.response;

  if (gate.session.mfaPassed) return apiOk({ verified: true, via: "session" });

  /* Keyed on the session, not the IP: an attacker guessing codes for one
   * account cannot escape the budget by rotating source addresses. */
  const limit = rateLimit(`mfa-verify:${gate.session.id}`, MFA_LIMIT.perSession);
  if (!limit.ok) {
    const response = apiFail(
      `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
      429,
    );
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return response;
  }

  const body: unknown = await request.json().catch(() => null);
  const code =
    typeof body === "object" && body !== null && "code" in body
      ? String((body as { code: unknown }).code ?? "")
      : "";

  const asTotp = totpCodeSchema.safeParse({ code });
  const asRecovery = recoveryCodeSchema.safeParse({ code });

  if (!asTotp.success && !asRecovery.success) {
    return apiFail("Enter a six-digit code or a recovery code.", 422);
  }

  const userId = gate.session.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.totpSecret || !user.totpEnabled) {
    return apiFail("Finish authenticator setup first.", 409);
  }

  let via: "totp" | "recovery" | null = null;

  if (asTotp.success) {
    /* Reject any code at or below the counter stored by the last successful
     * verification, so a code cannot be replayed inside its 30-second window. */
    const timeStep = await verifyTotp({
      token: asTotp.data.code,
      secret: user.totpSecret,
      afterTimeStep: user.totpCounter,
    });

    if (timeStep !== null) {
      via = "totp";
      /* Advance the counter only once the code is known good. */
      await prisma.user.update({
        where: { id: userId },
        data: { totpCounter: timeStep },
      });
    }
  }

  if (!via) {
    const codes = await prisma.recoveryCode.findMany({
      where: { userId, usedAt: null },
      select: { id: true, codeHash: true, usedAt: true },
    });

    const matchedId = await checkRecoveryCode(codes, code);

    if (matchedId) {
      await prisma.recoveryCode.update({
        where: { id: matchedId },
        data: { usedAt: new Date() },
      });
      via = "recovery";
    }
  }

  if (!via) {
    return apiFail("That code is not valid.", 401);
  }

  await markSessionMfaPassed(gate.session.id);

  const remaining = await prisma.recoveryCode.count({
    where: { userId, usedAt: null },
  });

  return apiOk({ verified: true, via, recoveryCodesRemaining: remaining });
}
