"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, ExternalLinkIcon } from "lucide-react";

import { CertificateSheet } from "@/components/certificate/CertificateSheet";
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

  const { data: cert, isLoading } = useQuery({
    queryKey: ["certificate", certificateId],
    queryFn: () => api.get<CertificateDetail>(`/certificates/${certificateId}`),
    enabled: open && Boolean(certificateId),
    staleTime: 30_000,
  });

  const verifyUrl = origin && cert ? `${origin}/verify/${cert.verificationToken}` : "";

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

        {isLoading || !cert ? (
          <div className="space-y-4">
            <Skeleton className="h-[28rem] w-full rounded-xl" />
          </div>
        ) : (
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
        )}

        {cert ? (
          <DialogFooter>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={`/api/certificates/${cert.id}/pdf`} download>
                <DownloadIcon className="size-4" />
                Download PDF
              </a>
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
