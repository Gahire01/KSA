"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BanknoteIcon,
  CreditCardIcon,
  EyeIcon,
  PlusIcon,
  PrinterIcon,
  SmartphoneIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import { ExportMenu } from "@/components/shared/ExportMenu";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { MultiSelectFilter } from "@/components/shared/MultiSelectFilter";
import { DataTable } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { formatDate, formatNumber, formatRwf } from "@/lib/utils/format";

type Method = "CASH" | "MOMO" | "BANK" | "CARD";
type Status = "PAID" | "PARTIAL" | "UNPAID";

interface PaymentRow {
  id: string;
  receiptNo: string;
  amountRwf: number;
  method: Method;
  reference: string | null;
  paidAt: string;
  recordedByName: string | null;
  isRefund: boolean;
  refundedBy: { id: string; receiptNo: string } | null;
  trainee: { id: string; fullName: string; traineeNo: string; paymentStatus: Status };
  course: { id: string; name: string } | null;
}

interface Summary {
  collectedThisMonthRwf: number;
  collectedLastMonthRwf: number;
  collectedTotalRwf: number;
  outstandingRwf: number;
  traineesUnpaid: number;
  traineesPartial: number;
}

const STATUS_LABEL: Record<Status, string> = { PAID: "Paid in full", PARTIAL: "Part paid", UNPAID: "Unpaid" };
const METHOD_LABEL: Record<Method, string> = { MOMO: "Mobile money", BANK: "Bank transfer", CASH: "Cash", CARD: "Card" };
const METHOD_ICON: Record<Method, React.ComponentType<{ className?: string }>> = {
  MOMO: SmartphoneIcon,
  BANK: BanknoteIcon,
  CASH: WalletIcon,
  CARD: CreditCardIcon,
};

export default function PaymentsPage() {
  const router = useRouter();

  const [searchDraft, setSearchDraft] = React.useState("");
  const search = useDebounce(searchDraft, 300);
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [methods, setMethods] = React.useState<string[]>([]);
  const [courseIds, setCourseIds] = React.useState<string[]>([]);

  /* Dashboard deep links: /payments?status=UNPAID,PARTIAL */
  React.useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (status) setStatuses(status.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean));
  }, []);

  const coursesQuery = useQuery({
    queryKey: ["courses", "options"],
    queryFn: async () => (await api.get<{ items: Array<{ id: string; name: string }> }>("/courses", { pageSize: 100 })).items,
    staleTime: 5 * 60_000,
  });

  const listQuery = useQuery({
    queryKey: ["payments", { search, statuses, methods, courseIds }],
    queryFn: () =>
      api.get<{ items: PaymentRow[]; total: number }>("/payments", {
        search: search || undefined,
        statuses,
        methods,
        courseIds,
        pageSize: 100,
      }),
    staleTime: 15_000,
  });
  const summaryQuery = useQuery({
    queryKey: ["payments", "summary"],
    queryFn: () => api.get<Summary>("/payments/summary"),
    staleTime: 30_000,
  });

  const rows = listQuery.data?.items ?? [];
  const summary = summaryQuery.data;
  const changePct =
    summary && summary.collectedLastMonthRwf > 0
      ? Math.round(((summary.collectedThisMonthRwf - summary.collectedLastMonthRwf) / summary.collectedLastMonthRwf) * 100)
      : undefined;

  const columns = React.useMemo<ColumnDef<PaymentRow, unknown>[]>(
    () => [
      {
        id: "receipt",
        header: "Receipt",
        accessorFn: (p) => p.receiptNo,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <AvatarInitials name={row.original.trainee.fullName} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-medium text-ink">{row.original.receiptNo}</p>
              <p className="truncate text-xs text-ink-3">{row.original.trainee.traineeNo}</p>
            </div>
          </div>
        ),
      },
      {
        id: "trainee",
        header: "Trainee",
        accessorFn: (p) => p.trainee.fullName,
        cell: ({ row }) => <span className="truncate text-sm text-ink">{row.original.trainee.fullName}</span>,
      },
      {
        id: "course",
        header: "Course",
        accessorFn: (p) => p.course?.name ?? "",
        cell: ({ row }) => <span className="text-sm text-ink-2">{row.original.course?.name ?? "—"}</span>,
      },
      {
        id: "amount",
        header: "Amount",
        accessorFn: (p) => p.amountRwf,
        cell: ({ row }) => (
          <span
            className={
              row.original.amountRwf < 0
                ? "text-sm font-medium whitespace-nowrap text-red tabular"
                : "text-sm font-medium whitespace-nowrap text-ink tabular"
            }
          >
            {formatRwf(row.original.amountRwf)}
          </span>
        ),
      },
      {
        id: "method",
        header: "Method",
        accessorFn: (p) => p.method,
        cell: ({ row }) => {
          const Icon = METHOD_ICON[row.original.method];
          return (
            <span className="flex items-center gap-1.5 text-sm whitespace-nowrap text-ink-2">
              <Icon className="size-3.5" />
              {METHOD_LABEL[row.original.method]}
            </span>
          );
        },
      },
      {
        id: "reference",
        header: "Reference",
        accessorFn: (p) => p.reference ?? "",
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap text-ink-3">{row.original.reference ?? "—"}</span>
        ),
      },
      {
        id: "paidAt",
        header: "Date",
        accessorFn: (p) => p.paidAt,
        cell: ({ row }) => <span className="text-sm whitespace-nowrap text-ink-2">{formatDate(row.original.paidAt)}</span>,
      },
      {
        id: "recorder",
        header: "Recorded by",
        accessorFn: (p) => p.recordedByName ?? "",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">{row.original.recordedByName ?? "—"}</span>
        ),
      },
      {
        id: "status",
        header: "Trainee",
        accessorFn: (p) => p.trainee.paymentStatus,
        cell: ({ row }) =>
          row.original.refundedBy ? (
            <StatusBadge status="void" label="Refunded" size="sm" />
          ) : (
            <StatusBadge
              status={row.original.trainee.paymentStatus}
              label={STATUS_LABEL[row.original.trainee.paymentStatus]}
              size="sm"
            />
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button asChild variant="ghost" size="icon-sm" aria-label={`Print receipt ${row.original.receiptNo}`}>
              <Link href={`/payments/${row.original.id}?print=1`}>
                <PrinterIcon className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon-sm" aria-label={`Open receipt ${row.original.receiptNo}`}>
              <Link href={`/payments/${row.original.id}`}>
                <EyeIcon className="size-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        subtitle={
          listQuery.isLoading
            ? "Loading the register…"
            : `${formatNumber(listQuery.data?.total ?? 0)} receipt${(listQuery.data?.total ?? 0) === 1 ? "" : "s"} in the register`
        }
        actions={
          <>
            <ExportMenu type="payments" params={{ courseIds, methods }} />
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/payments/new">
                <PlusIcon className="size-4" />
                Record payment
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Collected this month"
          value={formatRwf(summary?.collectedThisMonthRwf ?? 0)}
          icon={<TrendingUpIcon className="size-4" />}
          changePct={changePct}
          hint="net of refunds"
          isLoading={summaryQuery.isLoading}
        />
        <StatCard
          label="Collected in total"
          value={formatRwf(summary?.collectedTotalRwf ?? 0)}
          icon={<BanknoteIcon className="size-4" />}
          isLoading={summaryQuery.isLoading}
        />
        <StatCard
          label="Outstanding"
          value={formatRwf(summary?.outstandingRwf ?? 0)}
          icon={<WalletIcon className="size-4" />}
          hint="owed by enrolled trainees"
          isLoading={summaryQuery.isLoading}
        />
        <StatCard
          label="Not paid in full"
          value={formatNumber((summary?.traineesUnpaid ?? 0) + (summary?.traineesPartial ?? 0))}
          icon={<CreditCardIcon className="size-4" />}
          hint={`${formatNumber(summary?.traineesUnpaid ?? 0)} unpaid · ${formatNumber(summary?.traineesPartial ?? 0)} part paid`}
          href="/payments?status=UNPAID,PARTIAL"
          isLoading={summaryQuery.isLoading}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={searchDraft}
          onValueChange={setSearchDraft}
          placeholder="Search receipt, trainee or reference…"
          className="w-full sm:w-72"
        />
        <MultiSelectFilter
          label="Status"
          options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          selected={statuses}
          onChange={setStatuses}
        />
        <MultiSelectFilter
          label="Method"
          options={(Object.keys(METHOD_LABEL) as Method[]).map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
          selected={methods}
          onChange={setMethods}
        />
        <MultiSelectFilter
          label="Course"
          options={(coursesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          selected={courseIds}
          onChange={setCourseIds}
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={listQuery.isLoading}
        getRowId={(p) => p.id}
        onRowClick={(p) => router.push(`/payments/${p.id}`)}
        emptyState={
          <EmptyState
            title="No payments yet"
            description="Record a payment and it will appear here."
            action={
              <Button asChild size="sm">
                <Link href="/payments/new">Record payment</Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
