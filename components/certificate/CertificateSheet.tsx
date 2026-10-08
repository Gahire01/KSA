"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";

import { formatDate } from "@/lib/utils/format";

/**
 * The on-screen certificate. Mirrors lib/certificates/pdf.tsx element for element
 * (px here, pt there at x 0.75), so what staff preview is what the holder receives.
 *
 * Layout: logo top-right; KIGALI SAFETY ACADEMY centred under an orange divider;
 * the completion text; then signature block (left), one fact line (centre) and the
 * uncaptioned QR code (bottom-right). Navy 2px border, thin orange border inside.
 * There is no revoked, expiry or "scan" wording on the sheet.
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
  /** null = legacy certificate printed with the original static signature. */
  signerName: string | null;
  signerTitle: string | null;
  signatureUrl: string | null;
}

export function CertificateSheet({ cert, verifyUrl }: { cert: CertificateSheetData; verifyUrl: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border-2 border-[#0F2340] bg-card p-2.5 select-none print:rounded-none sm:p-3"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "url('/cert-bg.svg')", backgroundSize: "cover" }}
        aria-hidden
      />
      <div className="relative flex min-h-[28rem] flex-col items-center border border-orange px-5 pt-5 pb-6 text-center sm:px-10 sm:pb-8">
        <div className="flex w-full justify-end sm:absolute sm:top-5 sm:right-6 sm:w-auto">
          <Image
            src="/logo.png"
            alt="Kigali Safety Academy"
            width={80}
            height={80}
            draggable={false}
            className="pointer-events-none h-20 w-20 rounded-xl"
            priority={false}
          />
        </div>

        <div className="flex flex-col items-center gap-2 pt-2 sm:pt-7">
          <p className="font-display text-[28px] leading-tight font-semibold tracking-[0.12em] text-[#0F2340] uppercase">
            Kigali Safety Academy
          </p>
          <div className="h-px w-24 bg-orange" aria-hidden />
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-sm text-ink-2">This is to certify that</p>
          <p className="font-display text-[34px] leading-tight font-semibold text-[#0F2340]">{cert.traineeName}</p>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-ink-2">
            Has successfully completed KSAcademy occupational Health and Safety Course in
          </p>
          <p className="font-display text-[26px] leading-tight font-semibold tracking-wide text-orange uppercase">
            {cert.courseName}
          </p>
          {cert.topics.length > 0 ? (
            <p className="mx-auto max-w-[720px] text-[11px] leading-relaxed text-ink-2">
              Topics covered : {cert.topics.join(" , ")}
            </p>
          ) : null}
        </div>

        <div className="mt-auto grid w-full items-end gap-5 pt-8 sm:grid-cols-[1fr_auto_1fr]">
          {/* Signature: image sits on the line, name directly under it (gap <= 6px). */}
          <div className="mx-auto w-60 sm:mx-0">
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
              {cert.signerName ?? "Fredson Niyoniringiye"}
            </p>
            <p className="text-xs text-ink-2">{cert.signerTitle ?? "Director"}</p>
          </div>

          <p className="text-[11px] whitespace-nowrap text-ink-2">
            Student# <strong className="font-semibold text-[#0F2340]">{cert.studentNumber}</strong>
            <span className="px-2">·</span>
            Issued <strong className="font-semibold text-[#0F2340]">{formatDate(cert.issuedAt, "dd.MM.yyyy")}</strong>
            <span className="px-2">·</span>
            Duration <strong className="font-semibold text-[#0F2340]">{cert.duration}</strong>
          </p>

          <div className="flex justify-center sm:justify-end">
            <QRCodeSVG value={verifyUrl || " "} size={90} level="M" marginSize={1} />
          </div>
        </div>
      </div>
    </div>
  );
}
