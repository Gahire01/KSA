import type { CertificateStatus } from "@/lib/types";

/**
 * Certificate lifecycle, derived rather than stored.
 *
 * `revokedAt` and `expiresAt` are the only facts on the row; whether a certificate
 * reads as valid today depends on the clock, so the state is computed on read.
 * Storing it would need a nightly job to keep it honest.
 *
 * Precedence is deliberate: a revoked certificate stays revoked even after it would
 * also have expired, because "we withdrew this" is the more important message.
 */

export const EXPIRING_WINDOW_DAYS = 30;

export interface CertificateDates {
  revokedAt: Date | null;
  expiresAt: Date | null;
}

export function certificateStatus(
  cert: CertificateDates,
  now: Date = new Date(),
): CertificateStatus {
  if (cert.revokedAt) return "REVOKED";

  if (cert.expiresAt) {
    if (cert.expiresAt <= now) return "EXPIRED";
    if (cert.expiresAt.getTime() - now.getTime() <= EXPIRING_WINDOW_DAYS * 86_400_000) {
      return "EXPIRING";
    }
  }

  return "VALID";
}

/**
 * Fields the staff register and the certificate detail view share.
 *
 * `studentNumber` is included because staff search by it, but the trainee's email
 * and phone are not: the register is a compliance view and does not need contact
 * details, so keeping them out shrinks what a leaked export contains.
 */
export const certificateListSelect = {
  id: true,
  studentNumber: true,
  courseId: true,
  verificationToken: true,
  issuedAt: true,
  expiresAt: true,
  revokedAt: true,
  revokedReason: true,
  topicsSnapshot: true,
  durationSnapshot: true,
  trainerNameSnapshot: true,
  trainerTitleSnapshot: true,
  trainee: { select: { id: true, fullName: true, traineeNo: true } },
  course: { select: { id: true, code: true, name: true } },
} as const;

/**
 * What a holder of the link is allowed to learn.
 *
 * No email, no phone, no `contentHash`, no `id` — just what an employer checking a
 * certificate needs: who it is for, what it certifies, whether it still stands, and
 * the number they can cross-check on the printed sheet.
 */
export function publicCertificate(cert: {
  studentNumber: number;
  issuedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  topicsSnapshot: string[];
  durationSnapshot: string;
  trainerNameSnapshot: string;
  trainerTitleSnapshot: string;
  trainee: { fullName: string };
  course: { name: string; code: string };
}): Record<string, unknown> {
  const status = certificateStatus(cert);

  return {
    status,
    studentNumber: cert.studentNumber,
    traineeName: cert.trainee.fullName,
    /* No internal id and no enrolment number: an employer verifies a certificate,
     * not a trainee record, and neither identifier belongs in a public payload. */
    courseName: cert.course.name,
    courseCode: cert.course.code,
    topics: cert.topicsSnapshot,
    duration: cert.durationSnapshot,
    issuedAt: cert.issuedAt.toISOString(),
    expiresAt: cert.expiresAt ? cert.expiresAt.toISOString() : null,
    trainerName: cert.trainerNameSnapshot,
    trainerTitle: cert.trainerTitleSnapshot,
    /* Revocation is public in full: an employer must be able to see why a
     * certificate was withdrawn, not just that it was. */
    revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
    revokedReason: cert.revokedReason,
  };
}
