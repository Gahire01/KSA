"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PrinterIcon, RotateCcwIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { academyContactLine } from "@/lib/academy/constants";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDateTime, formatRwf } from "@/lib/utils/format";

interface Receipt {
  id: string;
  receiptNo: string;
  amountRwf: number;
  method: "CASH" | "MOMO" | "BANK" | "CARD";
  reference: string | null;
  notes: string | null;
  paidAt: string;
  recordedByName: string | null;
  isRefund: boolean;
  refundOfId: string | null;
  refundedBy: { id: string; receiptNo: string } | null;
  trainee: {
    id: string;
    fullName: string;
    traineeNo: string;
    amountPaidRwf: number;
    paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  };
  course: { id: string; name: string; priceRwf: number } | null;
}

const STATUS_LABEL = { PAID: "Paid in full", PARTIAL: "Part paid", UNPAID: "Unpaid" } as const;
const METHOD_LABEL = { CASH: "Cash", MOMO: "Mobile money", BANK: "Bank transfer", CARD: "Card" } as const;

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const isOwner = useAuthStore((s) => s.currentUser?.role === "OWNER");

  const [refundOpen, setRefundOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const query = useQuery({
    queryKey: ["payment", id],
    queryFn: () => api.get<Receipt>(`/payments/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
    retry: false,
  });
  const payment = query.data;

  const refundMutation = useMutation({
    mutationFn: () => api.post(`/payments/${encodeURIComponent(id)}/refund`, { reason: reason.trim() }),
    onSuccess: () => {
      toast.success("Refund recorded against this receipt.");
      setRefundOpen(false);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["payment", id] });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["trainees"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not record the refund."),
  });

  if (query.isLoading) {
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
        description="It may not exist, or you may not have access to payments."
        action={
          <Button asChild size="sm">
            <Link href="/payments">Back to payments</Link>
          </Button>
        }
      />
    );
  }

  const price = payment.course?.priceRwf ?? 0;
  const balance = Math.max(0, price - payment.trainee.amountPaidRwf);
  const canRefund = isOwner && payment.amountRwf > 0 && !payment.refundedBy;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        breadcrumbSlot={
          <Link href="/payments" className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Payments
          </Link>
        }
        title={payment.receiptNo}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={payment.trainee.paymentStatus} label={STATUS_LABEL[payment.trainee.paymentStatus]} />
            <span>{formatDateTime(payment.paidAt)}</span>
            {payment.isRefund ? <span className="font-medium text-red">Refund</span> : null}
            {payment.refundedBy ? (
              <Link href={`/payments/${payment.refundedBy.id}`} className="font-medium text-red underline">
                Refunded · {payment.refundedBy.receiptNo}
              </Link>
            ) : null}
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5 print:hidden" onClick={() => window.print()}>
              <PrinterIcon className="size-4" />
              Print receipt
            </Button>
            {canRefund ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red print:hidden"
                onClick={() => setRefundOpen((open) => !open)}
              >
                <RotateCcwIcon className="size-4" />
                Refund
              </Button>
            ) : null}
          </>
        }
      />

      {refundOpen ? (
        <Card className="print:hidden">
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Record a refund</CardTitle>
            <CardDescription>
              A negative entry is added against this receipt and the trainee&apos;s balance goes back up. The original
              receipt stays in the register.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="refund-reason">Reason</Label>
              <Textarea
                id="refund-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this being refunded?"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={reason.trim().length < 3 || refundMutation.isPending}
                onClick={() => refundMutation.mutate()}
              >
                {refundMutation.isPending ? "Recording…" : "Record refund"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRefundOpen(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Kigali Safety Academy" width={40} height={40} className="size-10" />
              <div>
                <p className="font-display text-base font-semibold text-ink">Kigali Safety Academy</p>
                <p className="text-[10px] tracking-widest text-ink-2 uppercase">{academyContactLine()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-semibold text-ink">
                {payment.isRefund ? "Refund note" : "Payment receipt"}
              </p>
              <p className="font-mono text-xs text-ink-2">{payment.receiptNo}</p>
            </div>
          </div>

          <dl className="grid gap-5 py-5 sm:grid-cols-2">
            <div className="space-y-3">
              <Line label="Received from">
                <Link
                  href={`/trainees/${payment.trainee.id}`}
                  className="flex items-center gap-2 underline decoration-line underline-offset-2 hover:decoration-orange print:no-underline"
                >
                  <AvatarInitials name={payment.trainee.fullName} size="xs" />
                  {payment.trainee.fullName}
                </Link>
                <span className="block font-mono text-xs text-ink-3">{payment.trainee.traineeNo}</span>
              </Line>
              <Line label="Course">{payment.course?.name ?? "—"}</Line>
              {payment.reference ? (
                <Line label="Reference">
                  <span className="font-mono text-xs">{payment.reference}</span>
                </Line>
              ) : null}
            </div>
            <div className="space-y-3">
              <Line label="Date">{formatDateTime(payment.paidAt)}</Line>
              <Line label="Method">{METHOD_LABEL[payment.method]}</Line>
              <Line label="Recorded by">{payment.recordedByName ?? "—"}</Line>
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
                    {payment.isRefund ? "Refund" : "Course fee"}
                    {payment.course ? ` — ${payment.course.name}` : ""}
                  </p>
                  {price > 0 ? <p className="text-xs text-ink-2">Standard fee {formatRwf(price)}</p> : null}
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
              {price === 0 ? null : balance > 0 ? (
                <>
                  Balance outstanding: <span className="font-semibold text-ink tabular">{formatRwf(balance)}</span>
                </>
              ) : (
                "Account settled"
              )}
            </p>
            <p className="font-display text-xl font-semibold text-ink tabular">{formatRwf(payment.amountRwf)}</p>
          </div>

          {payment.notes ? (
            <p className="mt-4 rounded-lg bg-paper px-3 py-2 text-xs text-ink-2">Notes: {payment.notes}</p>
          ) : null}

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="h-px bg-line" aria-hidden />
              <p className="mt-1 text-[10px] tracking-wider text-ink-2 uppercase">Cashier signature</p>
            </div>
          </div>

          <p className="mt-6 border-t border-line pt-3 text-center text-[10px] text-ink-3">
            Computer-generated receipt from Kigali Safety Academy · {payment.receiptNo} · amounts in Rwandan francs
            (RWF)
          </p>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Audit notes</CardTitle>
          <CardDescription>
            Receipts are immutable once posted. A mistake is corrected by recording a refund and a new payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <UserIcon className="size-3.5" />
            Recorded by {payment.recordedByName ?? "—"}
          </span>
        </CardContent>
      </Card>
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
