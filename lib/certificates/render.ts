import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import { DIRECTOR_NAME, DIRECTOR_TITLE } from "@/lib/certificates/issue";
import { certificateStatus } from "@/lib/certificates/status";
import { CertificateDocument, type CertificateDoc } from "@/lib/certificates/pdf";
import { appUrl } from "@/lib/email/send";
import { prisma } from "@/lib/db";

/**
 * Renders a certificate to PDF bytes.
 *
 * Reads only the snapshot columns plus the two relation names, so a renamed course
 * or trainee never rewrites an already-issued certificate. A revoked certificate
 * still renders — with a REVOKED banner — because suppressing it would leave an
 * employer holding a file that silently no longer exists anywhere.
 */

const pdfSelect = {
  studentNumber: true,
  topicsSnapshot: true,
  durationSnapshot: true,
  trainerNameSnapshot: true,
  trainerTitleSnapshot: true,
  issuedAt: true,
  expiresAt: true,
  revokedAt: true,
  revokedReason: true,
  verificationToken: true,
  trainee: { select: { fullName: true } },
  course: { select: { name: true } },
} as const;

export interface RenderedPdf {
  buffer: Buffer;
  filename: string;
}

export async function renderCertificatePdf(id: string): Promise<RenderedPdf | null> {
  const cert = await prisma.certificate.findUnique({
    where: { id },
    select: pdfSelect,
  });

  if (!cert) return null;

  const status = certificateStatus(cert);

  const doc: CertificateDoc = {
    studentNumber: cert.studentNumber,
    traineeName: cert.trainee.fullName,
    courseName: cert.course.name,
    topics: cert.topicsSnapshot,
    duration: cert.durationSnapshot,
    issuedAt: cert.issuedAt,
    expiresAt: cert.expiresAt,
    trainerName: cert.trainerNameSnapshot,
    trainerTitle: cert.trainerTitleSnapshot,
    directorName: DIRECTOR_NAME,
    directorTitle: DIRECTOR_TITLE,
    verifyUrl: appUrl(`/verify/${cert.verificationToken}`),
    status,
  };

  /* react-pdf wants a React element, not the component function itself. */
  const buffer = await renderToBuffer(
    React.createElement(CertificateDocument, { doc }),
  );

  /* A slug of the name keeps the download recognisable in a file listing without
   * letting a crafted name escape the filename. */
  const slug = cert.trainee.fullName
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .toLowerCase();

  return {
    buffer: Buffer.from(buffer),
    filename: `ksa-certificate-${cert.studentNumber}${slug ? `-${slug}` : ""}.pdf`,
  };
}
