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
  tierLabel: string | null;
}

export function CertificateSheet({ cert, verifyUrl }: { cert: CertificateSheetData; verifyUrl: string }) {
  const facts: Array<[string, string]> = [
    [String(cert.studentNumber), "Student #"],
    [formatDate(cert.issuedAt, "dd.MM.yyyy"), "Issued"],
    [cert.duration, "Duration"],
    ...(cert.tierLabel ? [[cert.tierLabel, "Package"] as [string, string]] : []),
  ];

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[#0F2340] bg-card select-none print:hidden"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Double navy border: outer 1px + 8px gap + inner 1px */}
      <div className="p-2">
        <div className="relative flex min-h-[32rem] flex-col items-center border border-[#0F2340] px-5 pt-6 pb-4 text-center sm:px-12">
          {/* Watermark */}
          <Image
            src="/logo.png"
            alt=""
            width={260}
            height={260}
            draggable={false}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 size-[260px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.06]"
          />

          <Image
            src="/logo.png"
            alt="Kigali Safety Academy"
            width={140}
            height={140}
            draggable={false}
            className="pointer-events-none h-[140px] w-[140px] object-contain"
            priority={false}
          />

          <p className="mt-3 font-serif text-sm text-ink-2 italic">This is to certify that</p>
          <p className="mt-1 w-full border-t border-b border-ink-3/50 py-1.5 font-display text-[36px] leading-tight font-semibold tracking-[0.05em] text-[#0F2340] uppercase">
            {cert.traineeName}
          </p>
          <p className="mx-auto mt-3 max-w-xl font-serif text-sm leading-relaxed text-ink-2 italic">
            Has successfully completed Kigali Safety Academy occupational Health and Safety Course in
          </p>
          <p className="mt-2 font-display text-[32px] leading-tight font-semibold tracking-wide text-[#0F2340] uppercase">
            {cert.courseName}
          </p>
          {cert.topics.length > 0 ? (
            <p className="mt-4 w-full text-left text-[11px] leading-relaxed text-justify text-ink-2">
              Topics covered : {cert.topics.join(" , ")}
            </p>
          ) : null}

          <div className="mt-auto grid w-full items-end gap-6 pt-8 sm:grid-cols-[1fr_auto]">
            <div className="mx-auto w-60 text-left sm:mx-0">
              <div className="flex h-[60px] items-end justify-center">
                {cert.signerName === null ? (
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
                  <Image
                    src={cert.signatureUrl}
                    alt={`Signature of ${cert.signerName}`}
                    width={240}
                    height={60}
                    unoptimized
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
              <p className="mt-0.5 text-[9px] text-ink-2">Kigali Safety Academy Safety and Health Training</p>
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
              <QRCodeSVG value={verifyUrl || " "} size={80} level="M" marginSize={1} />
              <p className="text-[7px] text-ink-3">Verify: {verifyUrl}</p>
            </div>
          </div>

          <p className="mt-3 w-full text-left font-mono text-[8px] text-ink-3">
            ★ Certificate ID: {cert.studentNumber}-{cert.contentHash.slice(0, 12).toUpperCase()} ★
          </p>
        </div>
      </div>
      {/* Bottom strip */}
      <div className="bg-[#0F2340] px-4 py-1.5 text-center">
        <p className="font-mono text-[7px] text-white/80">
          This certificate has been verified by Kigali Safety Academy · Issued to {cert.traineeName} · Student #{cert.studentNumber}
        </p>
      </div>
    </div>
  );
}
