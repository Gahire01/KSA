import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import React from "react";

import { DIRECTOR_NAME, DIRECTOR_TITLE } from "@/lib/certificates/issue";
import { CertificateDocument, type CertificateDoc } from "@/lib/certificates/pdf";
import { appUrl } from "@/lib/email/send";
import { prisma } from "@/lib/db";

/**
 * Renders a certificate to PDF bytes.
 *
 * Reads only the snapshot columns plus the two relation names, so a renamed course
 * or trainee never rewrites an already-issued certificate. A revoked certificate
 * still renders (the sheet itself carries no revoked marking; the public
 * verification page is where revocation shows) because suppressing it would leave
 * an employer holding a file that silently no longer exists anywhere.
 */

const pdfSelect = {
  studentNumber: true,
  topicsSnapshot: true,
  durationSnapshot: true,
  signatureUrlSnapshot: true,
  signerNameSnapshot: true,
  signerTitleSnapshot: true,
  issuedAt: true,
  contentHash: true,
  verificationToken: true,
  trainee: { select: { fullName: true } },
  course: { select: { name: true } },
} as const;

/**
 * Turns a snapshotted signature URL into an embeddable data URI by reading the
 * stored bytes directly (no HTTP round trip). `undefined` means "legacy
 * certificate, use the bundled static signature"; `null` means "issued with no
 * signature, print a plain line".
 */
async function resolveSignatureSrc(
  snapshotUrl: string | null,
  snapshotName: string | null,
): Promise<string | null | undefined> {
  /* Legacy = issued before the signature system, so no snapshot at all. New
   * certificates always carry a signer name; a null URL beside a name means
   * "issued with no active signature" and prints a plain line. */
  if (snapshotName === null) return undefined;
  if (snapshotUrl === null) return null;
  const match = /^\/api\/signature\/([A-Za-z0-9]+)\/image$/.exec(snapshotUrl);
  if (!match) return null;
  const row = await prisma.signature.findUnique({
    where: { id: match[1] },
    select: { imageData: true },
  });
  return row ? `data:image/png;base64,${Buffer.from(row.imageData).toString("base64")}` : null;
}

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

  const verifyUrl = appUrl(`/verify/${cert.verificationToken}`);

  const doc: CertificateDoc = {
    studentNumber: cert.studentNumber,
    traineeName: cert.trainee.fullName,
    courseName: cert.course.name,
    topics: cert.topicsSnapshot,
    duration: cert.durationSnapshot,
    issuedAt: cert.issuedAt,
    /* Certificates issued before the signature system carry no snapshot; they
     * keep the Director name and static image they were originally printed with. */
    directorName: cert.signerNameSnapshot ?? DIRECTOR_NAME,
    directorTitle: cert.signerTitleSnapshot ?? DIRECTOR_TITLE,
    signatureSrc: await resolveSignatureSrc(cert.signatureUrlSnapshot, cert.signerNameSnapshot),
    verifyUrl,
    contentHash: cert.contentHash,
    /* The QR encodes exactly the printed URL: {APP_URL}/verify/{verificationToken},
     * unique per certificate. */
    qrSrc: await QRCode.toDataURL(verifyUrl, { margin: 1, width: 300, errorCorrectionLevel: "M" }),
  };

  /* react-pdf wants a React element, not the component function itself. */
  const buffer = await renderToBuffer(
    React.createElement(CertificateDocument, { doc }),
  );

  /* The student number alone: numeric, so nothing a name could inject reaches
   * the Content-Disposition header. */
  return {
    buffer: Buffer.from(buffer),
    filename: `${cert.studentNumber}.pdf`,
  };
}
