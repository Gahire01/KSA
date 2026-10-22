/**
 * PDF template overlay: loads a pre-designed PDF template and stamps
 * dynamic fields (trainee name, date, QR code, signature) onto it
 * using pdf-lib.
 *
 * Every position comes from template-layout.ts, which the on-screen preview
 * (components/certificate/CertificateTemplate.tsx) reads too, so the two cannot drift.
 *
 * Falls back gracefully when a template is missing — the caller should
 * use the React-PDF renderer in that case.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";

import { templateFilenameFor, templateGeometry } from "@/lib/certificates/template-layout";

export interface OverlayInput {
  courseCode: string;
  courseName: string;
  traineeName: string;
  issuedAt: Date;
  verifyUrl: string;
  signatureSrc: string | null | undefined;
  directorName: string;
  directorTitle?: string;
  studentNumber: number;
  duration: string;
}

export interface OverlayResult {
  buffer: Buffer;
}

function templatePath(filename: string): string {
  return join(process.cwd(), "public", "templates", filename);
}

/**
 * Returns the template filename for this course, or null when no
 * template exists on disk.
 */
export function resolveTemplate(courseCode: string, courseName: string): string | null {
  const filename = templateFilenameFor(courseCode, courseName);
  return filename && existsSync(templatePath(filename)) ? filename : null;
}

function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

export async function overlayTemplate(
  templateFilename: string,
  input: OverlayInput,
): Promise<OverlayResult> {
  const pdfDoc = await PDFDocument.load(readFileSync(templatePath(templateFilename)));
  const page = pdfDoc.getPages()[0]!;
  const { width, height } = page.getSize();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);
  const g = templateGeometry(width, height);

  const fittedText = (text: string, x: number, y: number, maxWidth: number, size: number, strong = false) => {
    const font = strong ? bold : regular;
    const fittedSize = Math.min(size, size * maxWidth / Math.max(1, font.widthOfTextAtSize(text, size)));
    page.drawText(text, { x, y, size: fittedSize, font, color: black });
  };

  // All five supplied templates use the same 842.16 x 612 layout. The name
  // band is ABOVE the completion sentence, not at 52% of the page height.
  // Mask the entire placeholder band even when the new name is very short.
  page.drawRectangle({ ...g.nameMask, color: white });
  const name = input.traineeName.trim().toUpperCase();
  const nameSize = Math.min(
    g.name.size,
    g.name.size * g.name.maxWidth / Math.max(1, bold.widthOfTextAtSize(name, g.name.size)),
  );
  page.drawText(name, {
    x: (width - bold.widthOfTextAtSize(name, nameSize)) / 2,
    y: g.name.baselineY,
    size: nameSize,
    font: bold,
    color: black,
  });
  // The completion sentence and course title are original template artwork.
  // Never stamp a second name or rewrite that sentence.

  // Remove the sample footer, including its QR and certificate ID, before
  // drawing a single, aligned footer within the original border.
  page.drawRectangle({ ...g.footerMask, color: white });

  const signatureX = g.signature.x;
  const signatureWidth = g.signature.width;
  const footerLineY = g.signature.lineY;
  const legacySignaturePath = join(process.cwd(), "public", "certificate", "signature.png");
  const signatureBytes = input.signatureSrc === undefined && existsSync(legacySignaturePath)
    ? readFileSync(legacySignaturePath)
    : input.signatureSrc?.startsWith("data:image/png;base64,")
      ? Buffer.from(input.signatureSrc.split(",")[1]!, "base64")
      : null;
  if (signatureBytes) {
    const signature = await pdfDoc.embedPng(signatureBytes);
    const scale = Math.min(g.signature.maxImageWidth / signature.width, g.signature.maxImageHeight / signature.height);
    const w = signature.width * scale;
    const h = signature.height * scale;
    page.drawImage(signature, {
      x: signatureX + (signatureWidth - w) / 2,
      y: footerLineY + g.signature.imageGap,
      width: w,
      height: h,
    });
  }
  page.drawLine({ start: { x: signatureX, y: footerLineY }, end: { x: signatureX + signatureWidth, y: footerLineY }, thickness: 1, color: black });
  const centeredText = (text: string, x: number, y: number, maxWidth: number, size: number) => {
    const fittedSize = Math.min(size, size * maxWidth / Math.max(1, regular.widthOfTextAtSize(text, size)));
    fittedText(text, x + (maxWidth - regular.widthOfTextAtSize(text, fittedSize)) / 2, y, maxWidth, fittedSize);
  };
  centeredText(input.directorName, signatureX, footerLineY - 14, signatureWidth, g.signature.nameSize);
  centeredText(input.directorTitle ?? "Director", signatureX, footerLineY - 30, signatureWidth, g.signature.titleSize);

  const columnWidth = g.fieldColumnWidth;
  const values: Record<string, string> = {
    "Trainee No.": String(input.studentNumber),
    "Issue Date": formatDate(input.issuedAt),
    Duration: input.duration,
  };
  for (const field of g.fields) {
    page.drawLine({ start: { x: field.x, y: footerLineY }, end: { x: field.x + columnWidth, y: footerLineY }, thickness: 1, color: black });
    centeredText(values[field.label]!, field.x, footerLineY + 8, columnWidth, g.fieldValueSize);
    centeredText(field.label, field.x, footerLineY - 14, columnWidth, g.fieldLabelSize);
  }

  const qrBytes = await QRCode.toBuffer(input.verifyUrl, { margin: 2, width: 300, errorCorrectionLevel: "M" });
  const qrImage = await pdfDoc.embedPng(qrBytes);
  page.drawImage(qrImage, { x: g.qr.x, y: g.qr.y, width: g.qr.size, height: g.qr.size });
  return { buffer: Buffer.from(await pdfDoc.save()) };
}
