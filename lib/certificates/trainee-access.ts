interface TraineeCertificate {
  traineeId: string;
  courseId: string;
  revokedAt: Date | null;
  attempt: {
    traineeId: string;
    courseId: string;
    status: string;
    tokenHash: string;
  } | null;
}

/** A staff-free download still requires the OTP-proven browser and exact sitting. */
export function canTraineeDownloadCertificate(
  certificate: TraineeCertificate | null,
  tokenHash: string,
  sessionVerified: boolean,
): boolean {
  const attempt = certificate?.attempt;
  return Boolean(
    sessionVerified && certificate && !certificate.revokedAt && attempt &&
    attempt.status === "PASSED" && attempt.tokenHash === tokenHash &&
    attempt.traineeId === certificate.traineeId && attempt.courseId === certificate.courseId,
  );
}
