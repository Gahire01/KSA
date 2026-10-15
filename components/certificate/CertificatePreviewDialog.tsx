"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, ExternalLinkIcon, LoaderIcon } from "lucide-react";
import { toast } from "sonner";

const CertificateSheet = dynamic(
  () => import("@/components/certificate/CertificateSheet").then((m) => m.CertificateSheet),
  { ssr: false, loading: () => <div className="h-[28rem] w-full animate-pulse rounded-xl bg-muted" /> },
);
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import type { CertificateStatus } from "@/lib/types";

interface CertificateDetail {
  id: string;
  studentNumber: number;
  verificationToken: string;
  contentHash: string;
  topicsSnapshot: string[];
  durationSnapshot: string;
  trainerNameSnapshot: string;
  trainerTitleSnapshot: string;
  signatureUrlSnapshot: string | null;
  signerNameSnapshot: string | null;
  signerTitleSnapshot: string | null;
  issuedAt: string;
  status: CertificateStatus;
  trainee: {
    fullName: string;
    tierLabel: string | null;
  };
  course: { name: string };
}

export function CertificatePreviewDialog({
  certificateId,
  open,
  onOpenChange,
}: {
  certificateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [origin, setOrigin] = React.useState("");
  React.useEffect(
    () => setOrigin((process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin).replace(/\/+$/, "")),
    [],
  );

  const [downloading, setDownloading] = React.useState(false);

  const { data: cert, isLoading, isError, error } = useQuery({
    queryKey: ["certificate", certificateId],
    queryFn: () => api.get<CertificateDetail>(`/certificates/${certificateId}`),
    enabled: open && Boolean(certificateId),
    staleTime: 30_000,
  });

  const verifyUrl = origin && cert ? `${origin}/verify/${cert.verificationToken}` : "";

  const handleDownload = React.useCallback(async () => {
    if (!cert) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/certificates/${cert.id}/pdf`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cert.studentNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Certificate downloaded");
    } catch (err) {
      toast.error((err as Error)?.message || "Couldn't generate PDF — please try again");
    } finally {
      setDownloading(false);
    }
  }, [cert]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cert ? `Certificate ${cert.studentNumber}` : "Certificate Preview"}
          </DialogTitle>
          <DialogDescription>
            {cert ? `${cert.trainee.fullName} — ${cert.course.name}` : "Loading certificate…"}
          </DialogDescription>
        </DialogHeader>

        {isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-red">
              {(error as Error)?.message ?? "Could not load certificate"}
            </p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : isLoading || !cert ? (
          <div className="space-y-4">
            <Skeleton className="h-[28rem] w-full rounded-xl" />
          </div>
        ) : (
          <div className="overflow-auto">
            <div className="origin-top-left scale-[0.7]" style={{ width: "142.86%" }}>
              <CertificateSheet
                verifyUrl={verifyUrl}
                cert={{
                  studentNumber: cert.studentNumber,
                  traineeName: cert.trainee.fullName,
                  courseName: cert.course.name,
                  topics: cert.topicsSnapshot,
                  duration: cert.durationSnapshot,
                  issuedAt: cert.issuedAt,
                  contentHash: cert.contentHash,
                  signerName: cert.signerNameSnapshot,
                  signerTitle: cert.signerTitleSnapshot,
                  signatureUrl: cert.signatureUrlSnapshot,
                  tierLabel: cert.trainee.tierLabel ?? null,
                }}
              />
            </div>
          </div>
        )}

        {cert ? (
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={downloading}
              onClick={() => void handleDownload()}
            >
              {downloading ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              {downloading ? "Generating PDF…" : "Download PDF"}
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/certificates/${cert.id}`}>
                <ExternalLinkIcon className="size-4" />
                View details
              </Link>
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
