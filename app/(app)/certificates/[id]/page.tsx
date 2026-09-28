"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheckIcon,
  BanIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  HashIcon,
  PrinterIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { mockApi } from "@/lib/mock";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils/format";
import type { CertificateStatus } from "@/lib/types";

const STATUS_LABEL: Record<CertificateStatus, string> = {
  VALID: "Valid",
  EXPIRING: "Expiring soon",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};

const REVOKE_REASONS = [
  "Issued in error",
  "Assessment result disputed",
  "Trainee identity mismatch",
  "Course superseded",
  "Requested by holder",
] as const;

export default function CertificateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const canManage = role === "OWNER" || role === "ADMIN";

  const [revokeOpen, setRevokeOpen] = React.useState(false);
  const [revokeReason, setRevokeReason] = React.useState<string>(REVOKE_REASONS[0]);
  const [revokeNotes, setRevokeNotes] = React.useState("");

  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);

  const certQuery = useQuery({
    queryKey: ["certificate", id],
    queryFn: () => mockApi.certificates.get(id),
    enabled: Boolean(id),
  });
  const coursesQuery = useQuery({
    queryKey: ["courses", "options"],
    queryFn: () => mockApi.courses.list(),
    staleTime: 5 * 60_000,
  });
  const trainersQuery = useQuery({
    queryKey: ["trainers", "options"],
    queryFn: () => mockApi.trainers.list(),
    staleTime: 5 * 60_000,
  });
  const traineesQuery = useQuery({
    queryKey: ["trainees", "roster-map"],
    queryFn: () => mockApi.trainees.all(),
    staleTime: 60_000,
  });

  const cert = certQuery.data;
  const trainee = traineesQuery.data?.find((t) => t.id === cert?.traineeId);
  const course = coursesQuery.data?.find((c) => c.id === cert?.courseId);
  const trainer = trainersQuery.data?.find((t) => t.id === cert?.trainerId);
  const verifyUrl = origin ? `${origin}/verify?token=${cert?.verificationToken ?? ""}` : "";

  const revokeMutation = useMutation({
    mutationFn: () => mockApi.certificates.revoke(id, revokeReason, revokeNotes.trim()),
    onSuccess: () => {
      toast.success("Certificate revoked", {
        description: "The public verification page now shows it as revoked.",
      });
      setRevokeOpen(false);
      setRevokeNotes("");
      void queryClient.invalidateQueries({ queryKey: ["certificate", id] });
      void queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: () => toast.error("Could not revoke this certificate."),
  });

  if (certQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!cert) {
    return (
      <EmptyState
        title="Certificate not found"
        description="It may have been removed from the register."
        action={
          <Button asChild size="sm">
            <Link href="/certificates">Back to register</Link>
          </Button>
        }
      />
    );
  }

  const isVoided = cert.status === "REVOKED";

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbSlot={
          <Link
            href="/certificates"
            className="text-sm text-ink-2 transition-colors hover:text-ink"
          >
            ← Certificates
          </Link>
        }
        title={cert.certNo}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={cert.status} label={STATUS_LABEL[cert.status]} />
            <span>issued {formatDate(cert.issuedAt)}</span>
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 print:hidden"
              onClick={() => window.print()}
            >
              <PrinterIcon className="size-4" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 print:hidden"
              onClick={() => {
                toast.message("PDF export", {
                  description: "In production this streams the signed PDF from storage.",
                });
              }}
            >
              <DownloadIcon className="size-4" />
              Download PDF
            </Button>
            {canManage && !isVoided ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red print:hidden"
                onClick={() => setRevokeOpen(true)}
              >
                <BanIcon className="size-4" />
                Revoke
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ── Printable certificate ───────────────────────────── */}
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="p-0">
            <div className="relative overflow-hidden rounded-xl border border-line bg-card p-6 print:rounded-none print:border-0 sm:p-10">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{ backgroundImage: "url('/cert-bg.svg')", backgroundSize: "cover" }}
                aria-hidden
              />
              <div className="relative space-y-6 text-center">
                <div className="flex items-center justify-center gap-2.5">
                  <Image src="/logo.svg" alt="" width={36} height={36} className="size-9" />
                  <div className="text-left">
                    <p className="font-display text-base leading-tight font-semibold text-ink">
                      Kigali Safety Academy
                    </p>
                    <p className="text-[10px] tracking-widest text-ink-2 uppercase">
                      Republic of Rwanda · MINECOFIN accredited
                    </p>
                  </div>
                </div>

                <div>
                  <p className="font-display text-[11px] tracking-[0.3em] text-orange uppercase">
                    Certificate of completion
                  </p>
                  <p className="mt-2 font-display text-xl text-ink-2 sm:text-2xl">
                    This certifies that
                  </p>
                  <p className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
                    {trainee?.name ?? "—"}
                  </p>
                  {trainee ? (
                    <p className="mt-1 font-mono text-xs text-ink-3">
                      {trainee.traineeNo} · {trainee.category}
                    </p>
                  ) : null}
                </div>

                <p className="mx-auto max-w-lg text-sm leading-relaxed text-ink-2">
                  has satisfied every requirement of the approved training programme
                </p>
                <p className="font-display text-2xl font-semibold text-ink">
                  {course?.name ?? "—"}
                </p>
                <p className="text-sm text-ink-2">
                  {cert.durationLabel} · assessed on site · score{" "}
                  <span className="font-semibold text-ink">{cert.score}%</span>
                </p>

                <div className="mx-auto grid max-w-xl gap-4 pt-2 sm:grid-cols-3">
                  <SignOff label="Issue date" value={formatDate(cert.issuedAt)} />
                  <SignOff label="Valid until" value={cert.expiresAt ? formatDate(cert.expiresAt) : "No expiry"} />
                  <SignOff label="Certificate no." value={cert.certNo} mono />
                </div>

                <div className="flex flex-col items-center gap-1 pt-2">
                  <p className="font-display text-sm italic text-ink">
                    {trainer?.name ?? "—"}
                  </p>
                  <div className="h-px w-40 bg-line" aria-hidden />
                  <p className="text-[10px] tracking-wider text-ink-2 uppercase">
                    Lead trainer · signature
                  </p>
                  <Image
                    src="/stamp-sample.png"
                    alt="Official stamp"
                    width={64}
                    height={64}
                    className="mt-1 size-16 opacity-80 grayscale"
                  />
                </div>

                <p className="font-mono text-[10px] text-ink-3">
                  Content hash {cert.contentHash} · PDF ref {cert.pdfKey}
                </p>
              </div>

              {isVoided ? (
                <div
                  className="absolute inset-0 flex rotate-[-12deg] items-center justify-center"
                  aria-hidden
                >
                  <span className="rounded-xl border-4 border-red/70 px-8 py-3 font-display text-4xl font-semibold tracking-widest text-red/70 uppercase">
                    Revoked
                  </span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* ── Verification + metadata ─────────────────────────── */}
        <div className="space-y-4 print:hidden">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base flex items-center gap-2">
                <BadgeCheckIcon className="size-4 text-green" />
                Public verification
              </CardTitle>
              <CardDescription>
                Anyone with this link can confirm authenticity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2">
                <HashIcon className="size-3.5 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2">
                  {verifyUrl || "…"}
                </span>
                {verifyUrl ? (
                  <CopyButton value={verifyUrl} label="link" size={15} toastMessage="Verification link copied" />
                ) : null}
              </div>
              <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                <Link href={`/verify?token=${cert.verificationToken}`} target="_blank">
                  <ShieldCheckIcon className="size-4" />
                  Open verification page
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Holder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href={`/trainees/${cert.traineeId}`}
                className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 transition-colors hover:bg-paper"
              >
                <AvatarInitials name={trainee?.name ?? "?"} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {trainee?.name ?? cert.traineeId}
                  </span>
                  <span className="block font-mono text-xs text-ink-3">
                    {trainee?.traineeNo ?? "—"}
                  </span>
                </span>
              </Link>
              <dl className="space-y-1.5 text-sm">
                <Row label="Course" value={course?.name ?? "—"} />
                <Row label="Lead trainer" value={trainer?.name ?? "—"} />
                <Row label="Score" value={`${cert.score}%`} />
                <Row label="Attempt" value={<span className="font-mono text-xs">{cert.attemptId || "—"}</span>} />
                <Row label="Exam" value={<span className="font-mono text-xs">{cert.examId || "—"}</span>} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base flex items-center gap-2">
                <FileTextIcon className="size-4 text-ink-2" />
                Audit trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-1.5 text-sm">
                <Row label="Issued" value={formatDateTime(cert.issuedAt)} />
                <Row
                  label="Expires"
                  value={cert.expiresAt ? formatDateTime(cert.expiresAt) : "No expiry"}
                />
                <Row
                  label="Revoked"
                  value={cert.revokedAt ? formatDateTime(cert.revokedAt) : "—"}
                />
                <Row label="Reason" value={cert.revokeReason ?? "—"} />
                <Row label="Hash" value={<span className="font-mono text-xs">{cert.contentHash}</span>} />
                <Row label="PDF ref" value={<span className="font-mono text-xs">{cert.pdfKey}</span>} />
              </dl>
              {isVoided ? (
                <p className="mt-3 rounded-lg bg-red-bg px-3 py-2 text-xs text-red">
                  Revoked {cert.revokedAt ? formatDateTime(cert.revokedAt) : ""}. Employers
                  checking this certificate will see the revocation.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <p className="text-xs text-ink-3">
            {formatNumber(cert.score)}% score · certificate duration label{" "}
            {cert.durationLabel}
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke this certificate?"
        description="Revocation is permanent and shows on the public verification page. The record is kept for audit."
        confirmLabel="Revoke certificate"
        destructive
        onConfirm={() => revokeMutation.mutate()}
      />

      {revokeOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card p-4 shadow-lg print:hidden sm:inset-auto sm:bottom-6 sm:right-6 sm:w-96 sm:rounded-xl sm:border">
          <p className="mb-2 text-sm font-semibold text-ink">Revocation reason</p>
          <div className="space-y-2">
            <Select value={revokeReason} onValueChange={(v) => setRevokeReason(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVOKE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label htmlFor="revoke-notes" className="text-xs">
              Internal notes (optional)
            </Label>
            <Textarea
              id="revoke-notes"
              rows={2}
              value={revokeNotes}
              onChange={(e) => setRevokeNotes(e.target.value)}
              placeholder="Reference the email or incident that prompted this."
            />
            <p className="flex items-start gap-1.5 text-xs text-ink-3">
              <CopyIcon className="mt-0.5 size-3" />
              Notes are stored in the audit log only.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="min-w-0 truncate text-right text-xs font-medium text-ink">{value}</dd>
    </div>
  );
}

function SignOff({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] tracking-wider text-ink-2 uppercase">{label}</p>
      <p className={mono ? "mt-0.5 font-mono text-xs text-ink" : "mt-0.5 text-sm font-medium text-ink"}>
        {value}
      </p>
    </div>
  );
}
