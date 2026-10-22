/**
 * Where everything sits on the owner's designed certificate templates.
 *
 * Pure data and no `fs`, so the server stamp (template-overlay.ts, pdf-lib) and the
 * on-screen preview (components/certificate/CertificateTemplate.tsx, SVG) read the same
 * numbers. That is what keeps the preview identical to the PDF: change a position here
 * and both move.
 *
 * All coordinates are PDF points with the origin at the bottom-left, the way pdf-lib
 * takes them.
 */

/** The five supplied templates share one page size. */
export const TEMPLATE_PAGE = { width: 842.16, height: 612 } as const;

/** Course code (uppercased, trimmed) -> template PDF under `public/templates/`. */
export const TEMPLATE_MAP: Record<string, string> = {
  "CONSTRUCT-HSE": "CONSTRUCT SAFETY MANAGEMENT HSE.pdf",
  "FIRE-FIGHTING": "Fire Fighting.pdf",
  "FIRST-AID": "First Aid.pdf",
  "OCC-HEALTH": "Occupational Health.pdf",
  RIGER: "Riger.pdf",
};

/** Template PDF -> the rasterised background the preview draws under its overlay. */
export const TEMPLATE_PREVIEW: Record<string, string> = {
  "CONSTRUCT SAFETY MANAGEMENT HSE.pdf": "/certificate-previews/construct-hse.jpg",
  "Fire Fighting.pdf": "/certificate-previews/fire-fighting.jpg",
  "First Aid.pdf": "/certificate-previews/first-aid.jpg",
  "Occupational Health.pdf": "/certificate-previews/occupational-health.jpg",
  "Riger.pdf": "/certificate-previews/riger.jpg",
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

/** The template a course prints on, by name only (no disk check). Null = React-PDF fallback. */
export function templateFilenameFor(courseCode: string, courseName: string): string | null {
  return TEMPLATE_MAP[courseCode.toUpperCase().trim()] ?? fuzzyTemplateLookup(courseName);
}

export interface TemplateGeometry {
  /** White box over the sample trainee name that is part of the artwork. */
  nameMask: { x: number; y: number; width: number; height: number };
  name: { baselineY: number; maxWidth: number; size: number };
  /** White box over the sample footer (signature, fields, QR, certificate ID). */
  footerMask: { x: number; y: number; width: number; height: number };
  signature: {
    x: number;
    width: number;
    lineY: number;
    maxImageWidth: number;
    maxImageHeight: number;
    /** Gap between the rule and the bottom of the signature image. */
    imageGap: number;
    nameSize: number;
    titleSize: number;
  };
  fields: Array<{ label: "Trainee No." | "Issue Date" | "Duration"; x: number }>;
  fieldColumnWidth: number;
  fieldValueSize: number;
  fieldLabelSize: number;
  qr: { x: number; y: number; size: number };
}

export function templateGeometry(width: number, height: number): TemplateGeometry {
  return {
    nameMask: { x: width * 0.18, y: height * 0.62, width: width * 0.64, height: height * 0.065 },
    name: { baselineY: height * 0.64, maxWidth: width * 0.62, size: 25 },
    footerMask: { x: width * 0.075, y: height * 0.035, width: width * 0.885, height: height * 0.19 },
    signature: {
      x: width * 0.113,
      width: width * 0.183,
      lineY: height * 0.17,
      // PDF units are points: 150 CSS pixels = 112.5 points at 96 dpi.
      maxImageWidth: 112.5,
      maxImageHeight: height * 0.07,
      imageGap: 5,
      nameSize: 13,
      titleSize: 13,
    },
    fields: [
      { label: "Trainee No.", x: width * 0.325 },
      { label: "Issue Date", x: width * 0.46 },
      { label: "Duration", x: width * 0.608 },
    ],
    fieldColumnWidth: width * 0.096,
    fieldValueSize: 11,
    fieldLabelSize: 13,
    qr: { x: width * 0.842, y: height * 0.095, size: height * 0.105 },
  };
}
