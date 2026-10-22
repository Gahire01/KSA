"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";

import { DIRECTOR_NAME, DIRECTOR_TITLE } from "@/lib/certificates/signer";
import { TEMPLATE_PAGE, TEMPLATE_PREVIEW, templateGeometry } from "@/lib/certificates/template-layout";

/**
 * The on-screen twin of a template-based PDF (lib/certificates/template-overlay.ts).
 *
 * The PDF is the owner's designed artwork with the name, signature, fields and QR stamped
 * over it. This draws the same thing: the rasterised artwork, the same white masks, and
 * the same text and lines, all in PDF points inside an SVG whose viewBox is the PDF page.
 * Positions come from template-layout.ts, the file the stamp reads too, so the preview
 * cannot drift from the download. The fonts are Helvetica/Arial, the metrics the PDF's
 * built-in Helvetica uses, and text is shrunk to fit its column by the same rule.
 *
 * Anti-copy is the same honest scope as the old sheet: no context menu, no dragging.
 * A screenshot cannot be stopped; the real file is the session-gated PDF.
 */

const FONT = "Helvetica, Arial, 'Liberation Sans', sans-serif";

export interface CertificateTemplateData {
  studentNumber: number;
  traineeName: string;
  issuedAt: string;
  duration: string;
  /** null = legacy certificate printed with the original static signature. */
  signerName: string | null;
  signerTitle: string | null;
  signatureUrl: string | null;
}

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Text width in points for `size`, measured in Arial/Helvetica. Falls back to an average glyph width. */
function textWidth(text: string, size: number, bold: boolean): number {
  if (measureContext === undefined) {
    measureContext = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  }
  if (!measureContext) return text.length * size * (bold ? 0.6 : 0.55);
  measureContext.font = `${bold ? "bold " : ""}${size}px ${FONT}`;
  return measureContext.measureText(text).width;
}

/** The PDF's rule: never larger than `size`, shrunk until the text fits `maxWidth`. */
function fittedSize(text: string, size: number, maxWidth: number, bold: boolean): number {
  return Math.min(size, (size * maxWidth) / Math.max(1, textWidth(text, size, bold)));
}

function formatUtcDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

/** Whether a course has designed artwork to preview, i.e. whether the PDF takes the stamp path. */
export function previewBackground(templateFilename: string | null): string | null {
  return templateFilename ? (TEMPLATE_PREVIEW[templateFilename] ?? null) : null;
}

export function CertificateTemplate({
  cert,
  verifyUrl,
  background,
}: {
  cert: CertificateTemplateData;
  verifyUrl: string;
  /** Rasterised template artwork, from `previewBackground`. */
  background: string;
}) {
  const { width: W, height: H } = TEMPLATE_PAGE;
  const g = templateGeometry(W, H);

  /* PDF y runs up from the bottom; SVG y runs down from the top. */
  const flip = (y: number, height = 0) => H - y - height;

  const name = cert.traineeName.trim().toUpperCase();
  const nameSize = fittedSize(name, g.name.size, g.name.maxWidth, true);

  const directorName = cert.signerName ?? DIRECTOR_NAME;
  const directorTitle = cert.signerTitle ?? DIRECTOR_TITLE;
  const signatureSrc = cert.signerName === null ? "/certificate/signature.png" : cert.signatureUrl;

  const lineY = g.signature.lineY;
  const sigCentre = g.signature.x + g.signature.width / 2;

  const values: Record<string, string> = {
    "Trainee No.": String(cert.studentNumber),
    "Issue Date": formatUtcDate(cert.issuedAt),
    Duration: cert.duration,
  };

  const centred = (text: string, centreX: number, y: number, maxWidth: number, size: number, key: string) => (
    <text
      key={key}
      x={centreX}
      y={flip(y)}
      textAnchor="middle"
      fontFamily={FONT}
      fontSize={fittedSize(text, size, maxWidth, false)}
      fill="#000"
    >
      {text}
    </text>
  );

  return (
    <div
      className="relative w-full select-none overflow-hidden rounded-xl border border-line bg-white"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Certificate for ${cert.traineeName}, student number ${cert.studentNumber}`}
        className="block h-auto w-full"
      >
        <image href={background} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />

        {/* The artwork's sample name is covered, then the real one is stamped. */}
        <rect x={g.nameMask.x} y={flip(g.nameMask.y, g.nameMask.height)} width={g.nameMask.width} height={g.nameMask.height} fill="#fff" />
        <text
          x={W / 2}
          y={flip(g.name.baselineY)}
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight={700}
          fontSize={nameSize}
          fill="#000"
        >
          {name}
        </text>

        {/* The artwork's sample footer is covered, then the real one is stamped. */}
        <rect x={g.footerMask.x} y={flip(g.footerMask.y, g.footerMask.height)} width={g.footerMask.width} height={g.footerMask.height} fill="#fff" />

        {signatureSrc ? (
          <image
            href={signatureSrc}
            x={sigCentre - g.signature.maxImageWidth / 2}
            y={flip(lineY + g.signature.imageGap, g.signature.maxImageHeight)}
            width={g.signature.maxImageWidth}
            height={g.signature.maxImageHeight}
            preserveAspectRatio="xMidYMax meet"
          />
        ) : null}
        <line x1={g.signature.x} x2={g.signature.x + g.signature.width} y1={flip(lineY)} y2={flip(lineY)} stroke="#000" strokeWidth={1} />
        {centred(directorName, sigCentre, lineY - 14, g.signature.width, g.signature.nameSize, "director-name")}
        {centred(directorTitle, sigCentre, lineY - 30, g.signature.width, g.signature.titleSize, "director-title")}

        {g.fields.map((field) => {
          const centreX = field.x + g.fieldColumnWidth / 2;
          return (
            <g key={field.label}>
              <line x1={field.x} x2={field.x + g.fieldColumnWidth} y1={flip(lineY)} y2={flip(lineY)} stroke="#000" strokeWidth={1} />
              {centred(values[field.label] ?? "", centreX, lineY + 8, g.fieldColumnWidth, g.fieldValueSize, `${field.label}-value`)}
              {centred(field.label, centreX, lineY - 14, g.fieldColumnWidth, g.fieldLabelSize, `${field.label}-label`)}
            </g>
          );
        })}

        {/* The PDF's QR is a 300px PNG with a 2-module quiet zone, drawn square at this size. */}
        <g transform={`translate(${g.qr.x} ${flip(g.qr.y, g.qr.size)}) scale(${g.qr.size / 300})`}>
          <QRCodeSVG value={verifyUrl || " "} size={300} level="M" marginSize={2} />
        </g>
      </svg>
    </div>
  );
}
