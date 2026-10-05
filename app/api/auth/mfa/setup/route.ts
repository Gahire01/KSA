import { toDataURL } from "qrcode";

import { guardPendingSession } from "@/lib/api/guard";
import { apiFail, apiOk } from "@/lib/api/response";
import { buildOtpAuthUri, generateTotpSecret, TOTP_ISSUER } from "@/lib/auth/totp";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/mfa/setup
 *
 * Generates a secret and returns it as an otpauth:// URL plus a QR data URL.
 * The secret is stored but `totpEnabled` stays false until /mfa/confirm, so a
 * half-finished setup never locks the owner out.
 */
export async function POST() {
  const gate = await guardPendingSession();
  if (!gate.ok) return gate.response;

  const secret = generateTotpSecret();
  const { email } = gate.session.user;

  await prisma.user.update({
    where: { id: gate.session.user.id },
    data: { totpSecret: secret },
  });

  const otpauthUrl = buildOtpAuthUri(secret, email);

  try {
    const qrDataUrl = await toDataURL(otpauthUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    });

    return apiOk({
      otpauthUrl,
      qrDataUrl,
      issuer: TOTP_ISSUER,
      email,
    });
  } catch (error) {
    return apiFail("Could not render the QR code. Try again.", 500, { logError: error });
  }
}
