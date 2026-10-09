"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";

import { DIRECTOR_NAME, DIRECTOR_TITLE } from "@/lib/certificates/signer";
import { formatDate } from "@/lib/utils/format";

/**
 * The on-screen certificate. Mirrors lib/certificates/pdf.tsx element for element
 * (px here, pt there at x 0.75), so what staff preview is what the holder receives.
 *
 * Layout (after the academy's reference sample): large centred logo; italic lead-in; the
 * trainee's name on a ruled line; italic completion text; the course in large type; a
 * left-aligned topics paragraph; then signature block (bottom-left) and, bottom-right,
 * Student# / Issued / Duration as value-over-label with the uncaptioned QR beneath. A
 * thin certificate-ID line runs along the bottom. Navy 2px border, thin orange one inside,
 * a faint logo watermark behind. There is no revoked, expiry or "scan" wording on it.
 *
 * Anti-copy (honest scope): right-click and text selection are off and the images
 * cannot be dragged out. That deters casual saving; a screenshot cannot be stopped,
 * so the only download offered is the session-gated PDF.
 */

export interface CertificateSheetData {
  studentNumber: number;
  traineeName: string;
  courseName: string;
  topics: string[];
  duration: string;
  issuedAt: string;
  /** SHA-256 of the frozen snapshot; its first characters make the printed certificate ID. */
  contentHash: string;
  /** null = legacy certificate printed with the original static signature. */
  signerName: string | null;
  signerTitle: string | null;
  signatureUrl: string | null;
}

export function CertificateSheet({ cert, verifyUrl }: { cert: CertificateSheetData; verifyUrl: string }) {
  const facts: Array<[string, string]> = [
    [String(cert.studentNumber), "Student #"],
    [formatDate(cert.issuedAt, "dd.MM.yyyy"), "Issued"],
    [cert.duration, "Duration"],
  ];

  return (
    <div
      className="relative overflow-hidden rounded-xl border-2 border-[#0F2340] bg-card p-2.5 select-none print:hidden sm:p-3"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* A faint copy of the logo behind everything, exactly as the PDF prints it. */}
      <Image
        src="/logo.png"
        alt=""
        width={260}
        height={260}
        draggable={false}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[260px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.06]"
      />
      <div className="relative flex min-h-[32rem] flex-col items-center border border-orange px-5 pt-6 pb-4 text-center sm:px-12">
        <Image
          src="/logo.png"
          alt="Kigali Safety Academy"
          width={110}
          height={110}
          draggable={false}
          className="pointer-events-none h-[110px] w-[110px] object-contain"
          priority={false}
        />

        <p className="mt-3 font-serif text-sm text-ink-2 italic">This is to certify that</p>
        <p className="mt-1 w-full border-b border-ink-3/50 pb-1 font-display text-[34px] leading-tight font-semibold text-[#0F2340]">
          {cert.traineeName}
        </p>
        <p className="mx-auto mt-3 max-w-xl font-serif text-sm leading-relaxed text-ink-2 italic">
          Has successfully completed KSAcademy occupational Health and Safety Course in
        </p>
        <p className="mt-2 font-display text-[26px] leading-tight font-semibold tracking-wide text-orange uppercase">
          {cert.courseName}
        </p>
        {cert.topics.length > 0 ? (
          <p className="mt-4 w-full text-left text-[11px] leading-relaxed text-justify text-ink-2">
            Topics covered : {cert.topics.join(" , ")}
          </p>
        ) : null}

        <div className="mt-auto grid w-full items-end gap-6 pt-8 sm:grid-cols-[1fr_auto]">
          {/* Signature: image sits on the line, name directly under it (gap <= 6px). */}
          <div className="mx-auto w-60 text-left sm:mx-0">
            <div className="flex h-[60px] items-end justify-center">
              {cert.signerName === null ? (
                /* Issued before the signature system: original static image. */
                <Image
                  src="/certificate/signature.png"
                  alt="Signature of the Director"
                  width={160}
                  height={120}
                  draggable={false}
                  className="pointer-events-none max-h-[60px] w-auto max-w-60 object-contain"
                  priority={false}
                />
              ) : cert.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- served from our own API, no optimiser needed
                <img
                  src={cert.signatureUrl}
                  alt={`Signature of ${cert.signerName}`}
                  draggable={false}
                  className="pointer-events-none max-h-[60px] max-w-60 object-contain"
                />
              ) : null}
            </div>
            <div className="h-0.5 w-full bg-ink" aria-hidden />
            <p className="mt-1 font-display text-sm font-semibold text-[#0F2340]">
              {cert.signerName ?? DIRECTOR_NAME}
            </p>
            <p className="text-xs text-ink-2">{cert.signerTitle ?? DIRECTOR_TITLE}</p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <dl className="grid w-full grid-cols-3 gap-4 text-center sm:w-80">
              {facts.map(([value, label]) => (
                <div key={label}>
                  <dd className="border-b border-ink-3/50 pb-0.5 text-[12px] font-semibold text-[#0F2340]">{value}</dd>
                  <dt className="pt-0.5 text-[10px] text-ink-2">{label}</dt>
                </div>
              ))}
            </dl>
            <QRCodeSVG value={verifyUrl || " "} size={90} level="M" marginSize={1} />
          </div>
        </div>

        <p className="mt-3 w-full text-left font-mono text-[8px] text-ink-3">
          Certificate ID: {cert.studentNumber}-{cert.contentHash.slice(0, 12).toUpperCase()}
        </p>
      </div>
      {/* Outside the frame, like the PDF's footer: it ties a copy to its holder. */}
      <p className="relative mt-1.5 text-center font-mono text-[7px] text-ink-3">
        Issued to {cert.traineeName} · Student #{cert.studentNumber}
      </p>
    </div>
  );
}
