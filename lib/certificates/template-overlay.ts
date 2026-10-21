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
  studentNumber: number;
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
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export async function overlayTemplate(
  templateFilename: string,
  input: OverlayInput,
): Promise<OverlayResult> {
  const templateBytes = readFileSync(templatePath(templateFilename));
  const pdfDoc = await PDFDocument.load(templateBytes);

  const page = pdfDoc.getPages()[0]!;
  const { width, height } = page.getSize();

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  /* ── Cover the placeholder name with white, then draw the real name ── */
  // The placeholder "Umukundwa Evelyne" sits roughly in the center-top area.
  // These coordinates are approximate for the KSA templates (A4 landscape ~842x595).
  const nameY = height * 0.52;
  const nameSize = 22;
  const nameWidth = helveticaBold.widthOfTextAtSize(input.traineeName.toUpperCase(), nameSize);

  // White rectangle to cover placeholder name
  page.drawRectangle({
    x: (width - Math.max(nameWidth + 40, 350)) / 2,
    y: nameY - 5,
    width: Math.max(nameWidth + 40, 350),
    height: 35,
    color: rgb(1, 1, 1),
  });

  // Draw the real trainee name
  page.drawText(input.traineeName.toUpperCase(), {
    x: (width - nameWidth) / 2,
    y: nameY + 5,
    size: nameSize,
    font: helveticaBold,
    color: rgb(0.059, 0.137, 0.251), // navy #0F2340
  });

  /* ── Date ── */
  const dateStr = formatDate(input.issuedAt);
  const dateSize = 10;
  // Date typically goes in the bottom-right info area
  const dateX = width * 0.65;
  const dateY = height * 0.18;

  // Cover old date area
  page.drawRectangle({
    x: dateX - 5,
    y: dateY - 3,
    width: 100,
    height: 16,
    color: rgb(1, 1, 1),
  });

  page.drawText(dateStr, {
    x: dateX,
    y: dateY,
    size: dateSize,
    font: helvetica,
    color: rgb(0.059, 0.137, 0.251),
  });

  /* ── QR Code ── */
  const qrDataUrl = await QRCode.toDataURL(input.verifyUrl, {
    margin: 1,
    width: 200,
    errorCorrectionLevel: "M",
  });
  const qrBase64 = qrDataUrl.split(",")[1]!;
  const qrImage = await pdfDoc.embedPng(Buffer.from(qrBase64, "base64"));

  const qrSize = 55;
  const qrX = width * 0.82;
  const qrY = height * 0.08;

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  /* ── Director signature ── */
  if (input.signatureSrc && input.signatureSrc.startsWith("data:image/png;base64,")) {
    const sigBase64 = input.signatureSrc.split(",")[1]!;
    const sigImage = await pdfDoc.embedPng(Buffer.from(sigBase64, "base64"));

    const sigWidth = 120;
    const sigHeight = 40;
    const sigX = width * 0.10;
    const sigY = height * 0.14;

    page.drawImage(sigImage, {
      x: sigX,
      y: sigY,
      width: sigWidth,
      height: sigHeight,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return { buffer: Buffer.from(pdfBytes) };
}
