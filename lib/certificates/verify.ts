import { publicCertificate } from "@/lib/certificates/status";
import { extractToken, looksLikeVerificationToken } from "@/lib/certificates/token";
import { prisma } from "@/lib/db";
import type { CertificateStatus } from "@/lib/types";

/**
 * Public certificate lookup.
 *
 * Shared by `/api/verify/[token]` and the server-rendered `/verify/[token]` page so
 * both paths cannot drift: one shape, one projection, one set of fields.
 *
 * The payload is deliberately small. An employer needs to know who the certificate
 * is for, what it certifies, whether it still stands and the number they can
 * cross-check against the printed sheet. Nothing else is exposed — no email, no
 * phone, no internal id, and no `contentHash`, which is a fingerprint of the whole
 * row and would help an attacker confirm a guess.
 */

export interface PublicCertificate {
  status: CertificateStatus;
  studentNumber: number;
  traineeName: string;
  courseName: string;
  courseCode: string;
  topics: string[];
  duration: string;
  issuedAt: string;
  expiresAt: string | null;
  trainerName: string;
  trainerTitle: string;
  revokedAt: string | null;
  revokedReason: string | null;
}

const verifySelect = {
  studentNumber: true,
  issuedAt: true,
  expiresAt: true,
  revokedAt: true,
  revokedReason: true,
  topicsSnapshot: true,
  durationSnapshot: true,
  trainerNameSnapshot: true,
  trainerTitleSnapshot: true,
  trainee: { select: { fullName: true } },
  course: { select: { name: true, code: true } },
} as const;

export async function getPublicCertificate(
  token: string,
): Promise<PublicCertificate | null> {
  const candidate = extractToken(token);

  /* Length check first: anything not shaped like a base64url 32-byte token cannot
   * match, so a rubbish paste never reaches the database. */
  if (!looksLikeVerificationToken(candidate)) return null;

  const cert = await prisma.certificate.findUnique({
    where: { verificationToken: candidate },
    select: verifySelect,
  });

  if (!cert) return null;

  return publicCertificate(cert) as unknown as PublicCertificate;
}
