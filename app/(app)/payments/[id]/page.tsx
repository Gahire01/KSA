"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  PrinterIcon,
  RotateCcwIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { mockApi } from "@/lib/mock";
import { formatDateTime, formatRwf } from "@/lib/utils/format";
import type { PaymentStatus } from "@/lib/types";

const STATUS_LABEL: Record<PaymentStatus, string> = {
  PAID: "Paid in full",
  PARTIAL: "Part paid",
  UNPAID: "Unpaid",
};

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [refundOpen, setRefundOpen] = React.useState(false);

  const paymentQuery = useQuery({
    queryKey: ["payment", id],
    queryFn: () => mockApi.payments.get(id),
    enabled: Boolean(id),
  });
  const coursesQuery = useQuery({
    queryKey: ["courses", "options"],
    queryFn: () => mockApi.courses.list(),
    staleTime: 5 * 60_000,
  });
  const traineesQuery = useQuery({
    queryKey: ["trainees", "roster-map"],
    queryFn: () => mockApi.trainees.all(),
    staleTime: 60_000,
  });

  const payment = paymentQuery.data;
  const trainee = traineesQuery.data?.find((t) => t.id === payment?.traineeId);
  const course = coursesQuery.data?.find((c) => c.id === payment?.courseId);

  const refundMutation = useMutation({
    mutationFn: () => mockApi.payments.refund(id),
    onSuccess: () => {
      toast.success("Refund recorded against this receipt.");
      setRefundOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["payment", id] });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: () => toast.error("Could not record the refund."),
  });

  if (paymentQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!payment) {
    return (
      <EmptyState
        title="Receipt not found"
        description="It may have been removed from the ledger."
        action={
          <Button asChild size="sm">
            <Link href="/payments">Back to payments</Link>
          </Button>
        }
      />
    );
  }

  const balance = trainee
    ? Math.max(0, trainee.totalDueRwf - trainee.amountPaidRwf)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <DemoBanner>
        This receipt is demo data. Printing or refunding it does not change any
        stored payment record.
      </DemoBanner>

      <PageHeader
        breadcrumbSlot={
          <Link
            href="/payments"
            className="text-sm text-ink-2 transition-colors hover:text-ink"
          >
            ← Payments
          </Link>
        }
        title={payment.receiptNo}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={payment.status} label={STATUS_LABEL[payment.status]} />
            <span>{formatDateTime(payment.paidAt)}</span>
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
              Print receipt
            </Button>
            {payment.amountRwf > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red print:hidden"
                onClick={() => setRefundOpen(true)}
              >
                <RotateCcwIcon className="size-4" />
                Refund
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
            <div className="flex items-center gap-3">
              <Image src="/logo.svg" alt="" width={40} height={40} className="size-10" />
              <div>
                <p className="font-display text-base font-semibold text-ink">
                  Kigali Safety Academy
                </p>
                <p className="text-[10px] tracking-widest text-ink-2 uppercase">
                  KG 5 Ave · Kigali · +250 788 000 000
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-semibold text-ink">Payment receipt</p>
              <p className="font-mono text-xs text-ink-2">{payment.receiptNo}</p>
            </div>
          </div>

          <dl className="grid gap-5 py-5 sm:grid-cols-2">
            <div className="space-y-3">
              <Line label="Received from">
                {trainee ? (
                  <Link
                    href={`/trainees/${trainee.id}`}
                    className="flex items-center gap-2 underline decoration-line underline-offset-2 hover:decoration-orange print:no-underline"
                  >
                    <AvatarInitials name={trainee.name} size="xs" />
                    {trainee.name}
                  </Link>
                ) : (
                  payment.traineeId
                )}
                {trainee ? (
                  <span className="block font-mono text-xs text-ink-3">{trainee.traineeNo}</span>
                ) : null}
              </Line>
              <Line label="Course">{course?.name ?? "—"}</Line>
              <Line label="Reference">
                <span className="font-mono text-xs">{payment.reference}</span>
              </Line>
            </div>
            <div className="space-y-3">
              <Line label="Date paid">{formatDateTime(payment.paidAt)}</Line>
              <Line label="Method">{payment.method}</Line>
              <Line label="Recorded by">
                {mockApi.payments.recorderNames[payment.recordedById] ?? payment.recordedById}
              </Line>
            </div>
          </dl>

          <table className="w-full border-t border-line text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wider text-ink-2 uppercase">
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Amount (RWF)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="py-3">
                  <p className="font-medium text-ink">
                    Course fee — {course?.name ?? payment.courseId}
                  </p>
                  <p className="text-xs text-ink-2">
                    {payment.status === "PARTIAL" ? "Part payment" : "Full payment"} against{" "}
                    {course ? formatRwf(course.priceRwf) : "the course fee"}
                  </p>
                </td>
                <td
                  className={
                    payment.amountRwf < 0
                      ? "py-3 text-right font-semibold text-red tabular"
                      : "py-3 text-right font-semibold text-ink tabular"
                  }
                >
                  {formatRwf(payment.amountRwf)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink pt-3">
            <p className="text-sm text-ink-2">
              {balance === null ? null : balance > 0 ? (
                <>
                  Balance outstanding:{" "}
                  <span className="font-semibold text-ink tabular">{formatRwf(balance)}</span>
                </>
              ) : (
                "Account settled in full"
              )}
            </p>
            <p className="font-display text-xl font-semibold text-ink tabular">
                  {formatRwf(payment.amountRwf)}
            </p>
          </div>

          {payment.notes ? (
            <p className="mt-4 rounded-lg bg-paper px-3 py-2 text-xs text-ink-2">
              Notes: {payment.notes}
            </p>
          ) : null}

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="h-px bg-line" aria-hidden />
              <p className="mt-1 text-[10px] tracking-wider text-ink-2 uppercase">
                Cashier signature
              </p>
            </div>
            <div className="flex items-end justify-end">
              <Image
                src="/stamp-sample.png"
                alt="Official stamp"
                width={80}
                height={80}
                className="size-20 opacity-80 grayscale"
              />
            </div>
          </div>

          <p className="mt-6 border-t border-line pt-3 text-center text-[10px] text-ink-3">
            This is a computer-generated receipt from Kigali Safety Academy ·{" "}
            {payment.receiptNo} · amounts in Rwandan francs (RWF)
          </p>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Audit notes</CardTitle>
          <CardDescription>
            Receipts are immutable once posted. Corrections are made by recording a
            refund and a new payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-2">
          <p>
            <span className="inline-flex items-center gap-1.5">
              <UserIcon className="size-3.5" />
              Recorded by {mockApi.payments.recorderNames[payment.recordedById] ?? payment.recordedById}
            </span>
          </p>
          <p>
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeftIcon className="size-3.5" />
              Trainer of record: {course ? (coursesQuery.data ?? []).find((c) => c.id === payment.courseId)?.trainerId : "—"}
            </span>
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        title="Record a refund?"
        description="A negative entry is added against this receipt. The original record stays visible in the ledger."
        confirmLabel="Record refund"
        destructive
        onConfirm={() => refundMutation.mutate()}
      />
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wider text-ink-2 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}
