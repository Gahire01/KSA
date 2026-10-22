/**
 * PDF template overlay: loads a pre-designed PDF template and stamps
 * dynamic fields (trainee name, date, QR code, signature) onto it
 * using pdf-lib.
 *
 * Falls back gracefully when a template is missing — the caller should
 * use the React-PDF renderer in that case.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";

/**
 * Maps a course code (uppercased, trimmed) to the filename under
 * `public/templates/`. The academy's five launch templates are mapped
 * here; new courses without a template fall back to the React-PDF path.
 */
const TEMPLATE_MAP: Record<string, string> = {
  "CONSTRUCT-HSE": "CONSTRUCT SAFETY MANAGEMENT HSE.pdf",
  "FIRE-FIGHTING": "Fire Fighting.pdf",
  "FIRST-AID": "First Aid.pdf",
  "OCC-HEALTH": "Occupational Health.pdf",
  "RIGER": "Riger.pdf",
};

/**
 * Attempts a fuzzy match when the exact code isn't in the map.
 * Matches the first template whose filename (minus extension, lowered)
 * appears within the course name (lowered).
 */
function fuzzyTemplateLookup(courseName: string): string | null {
  const lower = courseName.toLowerCase();
  for (const [, filename] of Object.entries(TEMPLATE_MAP)) {
    const stem = filename.replace(/\.pdf$/i, "").toLowerCase();
    if (lower.includes(stem) || stem.includes(lower.replace(/\s+/g, " ").trim())) {
      return filename;
    }
  }
  // Keyword-based fallback
  if (lower.includes("construct") || lower.includes("hse") || lower.includes("safety management")) {
    return TEMPLATE_MAP["CONSTRUCT-HSE"]!;
  }
  if (lower.includes("fire") || lower.includes("fighting")) {
    return TEMPLATE_MAP["FIRE-FIGHTING"]!;
  }
  if (lower.includes("first aid")) {
    return TEMPLATE_MAP["FIRST-AID"]!;
  }
  if (lower.includes("occupational") || lower.includes("occ")) {
    return TEMPLATE_MAP["OCC-HEALTH"]!;
  }
  if (lower.includes("rig")) {
    return TEMPLATE_MAP["RIGER"]!;
  }
  return null;
}

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
  const direct = TEMPLATE_MAP[courseCode.toUpperCase().trim()];
  if (direct && existsSync(templatePath(direct))) return direct;

  const fuzzy = fuzzyTemplateLookup(courseName);
  if (fuzzy && existsSync(templatePath(fuzzy))) return fuzzy;

  return null;
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

  const fittedText = (text: string, x: number, y: number, maxWidth: number, size: number, strong = false) => {
    const font = strong ? bold : regular;
    const fittedSize = Math.min(size, size * maxWidth / Math.max(1, font.widthOfTextAtSize(text, size)));
    page.drawText(text, { x, y, size: fittedSize, font, color: black });
  };

  // All five supplied templates use the same 842.16 x 612 layout. The name
  // band is ABOVE the completion sentence, not at 52% of the page height.
  // Mask the entire placeholder band even when the new name is very short.
  page.drawRectangle({ x: width * 0.18, y: height * 0.62, width: width * 0.64, height: height * 0.065, color: white });
  const name = input.traineeName.trim().toUpperCase();
  const nameSize = Math.min(25, 25 * (width * 0.62) / Math.max(1, bold.widthOfTextAtSize(name, 25)));
  page.drawText(name, {
    x: (width - bold.widthOfTextAtSize(name, nameSize)) / 2,
    y: height * 0.64,
    size: nameSize,
    font: bold,
    color: black,
  });
  // The completion sentence and course title are original template artwork.
  // Never stamp a second name or rewrite that sentence.

  // Remove the sample footer, including its QR and certificate ID, before
  // drawing a single, aligned footer within the original border.
  page.drawRectangle({ x: width * 0.075, y: height * 0.035, width: width * 0.885, height: height * 0.19, color: white });

  const signatureX = width * 0.113;
  const signatureWidth = width * 0.183;
  const footerLineY = height * 0.17;
  const legacySignaturePath = join(process.cwd(), "public", "certificate", "signature.png");
  const signatureBytes = input.signatureSrc === undefined && existsSync(legacySignaturePath)
    ? readFileSync(legacySignaturePath)
    : input.signatureSrc?.startsWith("data:image/png;base64,")
      ? Buffer.from(input.signatureSrc.split(",")[1]!, "base64")
      : null;
  if (signatureBytes) {
    const signature = await pdfDoc.embedPng(signatureBytes);
    // PDF units are points: 150 CSS pixels = 112.5 points at 96 dpi.
    const scale = Math.min(112.5 / signature.width, (height * 0.07) / signature.height);
    const w = signature.width * scale;
    const h = signature.height * scale;
    page.drawImage(signature, { x: signatureX + (signatureWidth - w) / 2, y: footerLineY + 5, width: w, height: h });
  }
  page.drawLine({ start: { x: signatureX, y: footerLineY }, end: { x: signatureX + signatureWidth, y: footerLineY }, thickness: 1, color: black });
  const centeredText = (text: string, x: number, y: number, maxWidth: number, size: number) => {
    const fittedSize = Math.min(size, size * maxWidth / Math.max(1, regular.widthOfTextAtSize(text, size)));
    fittedText(text, x + (maxWidth - regular.widthOfTextAtSize(text, fittedSize)) / 2, y, maxWidth, fittedSize);
  };
  centeredText(input.directorName, signatureX, footerLineY - 14, signatureWidth, 13);
  centeredText(input.directorTitle ?? "Director", signatureX, footerLineY - 30, signatureWidth, 13);

  const columnWidth = width * 0.096;
  const fields = [
    { label: "Trainee No.", value: String(input.studentNumber), x: width * 0.325 },
    { label: "Issue Date", value: formatDate(input.issuedAt), x: width * 0.46 },
    { label: "Duration", value: input.duration, x: width * 0.608 },
  ];
  for (const field of fields) {
    page.drawLine({ start: { x: field.x, y: footerLineY }, end: { x: field.x + columnWidth, y: footerLineY }, thickness: 1, color: black });
    centeredText(field.value, field.x, footerLineY + 8, columnWidth, 11);
    centeredText(field.label, field.x, footerLineY - 14, columnWidth, 13);
  }

  const qrBytes = await QRCode.toBuffer(input.verifyUrl, { margin: 2, width: 300, errorCorrectionLevel: "M" });
  const qrImage = await pdfDoc.embedPng(qrBytes);
  const qrSize = height * 0.105;
  const qrX = width * 0.842;
  page.drawImage(qrImage, { x: qrX, y: height * 0.095, width: qrSize, height: qrSize });
  return { buffer: Buffer.from(await pdfDoc.save()) };
}
