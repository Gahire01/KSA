import { guardPendingSession } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { totpCodeSchema } from "@/lib/api/schemas";
import { markSessionMfaPassed } from "@/lib/auth/session";
import { generateRecoveryCodes, hashRecoveryCodes, verifyTotp } from "@/lib/auth/totp";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/mfa/confirm
 *
 * Confirms the first TOTP code, flips totpEnabled on, and issues recovery codes.
 * This is the only time the plaintext recovery codes exist anywhere.
 */
export async function POST(request: Request) {
  const gate = await guardPendingSession();
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = totpCodeSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const userId = gate.session.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.totpSecret) {
    return apiFail("Start authenticator setup first.", 409);
  }

  if (user.totpEnabled) {
    return apiFail("Authenticator is already enabled for this account.", 409);
  }

  /* Enrolment deliberately skips the replay check — this is the first code and
   * `totpCounter` is 0 — but the matched step is still recorded so the code that
   * was just used cannot be replayed afterwards. */
  const timeStep = await verifyTotp({
    token: parsed.data.code,
    secret: user.totpSecret,
  });
  if (timeStep === null) {
    return apiFail("That code is not valid. Check your device clock.", 422);
  }

  const codes = generateRecoveryCodes();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true, totpCounter: timeStep },
    }),
    /* Replace any codes from an abandoned earlier attempt. */
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({
      data: (await hashRecoveryCodes(codes)).map((codeHash) => ({ userId, codeHash })),
    }),
  ]);

  await markSessionMfaPassed(gate.session.id);

  return apiOk({ recoveryCodes: codes });
}
