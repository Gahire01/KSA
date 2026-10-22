"use client";

import { useState } from "react";
import { DownloadIcon, LoaderIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function TraineeCertificateDownload({ certificate, examToken }: {
  certificate: { id: string; studentNumber: number };
  examToken: string;
}) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const response = await fetch(`/api/certificates/${encodeURIComponent(certificate.id)}/pdf`, {
        credentials: "include",
        headers: { "X-Exam-Token": examToken },
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        let message = text;
        try { message = JSON.parse(text).error ?? text; } catch { /* Plain-text PDF errors. */ }
        throw new Error(message || "Could not download your certificate. Please try again.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `KSA-CERT-${certificate.studentNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Certificate downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download your certificate.");
    } finally {
      setBusy(false);
    }
  }
  return <Button size="lg" disabled={busy} onClick={download}>
    {busy ? <LoaderIcon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
    {busy ? "Generating PDF…" : "Download Certificate"}
  </Button>;
}
