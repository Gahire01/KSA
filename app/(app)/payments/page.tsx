"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BanknoteIcon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  PlusIcon,
  PrinterIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { FilterChips, type Chip } from "@/components/shared/FilterChips";
import { MultiSelectFilter } from "@/components/shared/MultiSelectFilter";
import { DateRangePicker, type DateRange } from "@/components/shared/DateRangePicker";
import { DataTable } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { mockApi } from "@/lib/mock";
import { formatDate, formatNumber, formatRwf } from "@/lib/utils/format";
import type { Payment, PaymentMethod, PaymentStatus } from "@/lib/types";

const FETCH_SIZE = 500;

const STATUSES: PaymentStatus[] = ["PAID", "PARTIAL", "UNPAID"];
const METHODS: PaymentMethod[] = ["MOMO", "BANK", "CASH", "CARD"];

const STATUS_LABEL: Record<PaymentStatus, string> = {
  PAID: "Paid in full",
  PARTIAL: "Part paid",
  UNPAID: "Unpaid",
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  MOMO: "Mobile money",
  BANK: "Bank transfer",
  CASH: "Cash",
  CARD: "Card",
};

const METHOD_ICON: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  MOMO: SmartphoneIcon,
  BANK: BanknoteIcon,
  CASH: WalletIcon,
  CARD: CreditCardIcon,
};

interface Filters {
  search: string;
  statuses: PaymentStatus[];
  methods: PaymentMethod[];
  courseIds: string[];
  range: DateRange;
}

const EMPTY: Filters = { search: "", statuses: [], methods: [], courseIds: [], range: {} };

export default function PaymentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [searchDraft, setSearchDraft] = React.useState("");
  const debouncedSearch = useDebounce(searchDraft, 300);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status) {
      setFilters((f) => ({
        ...f,
        statuses: status
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s): s is PaymentStatus => (STATUSES as string[]).includes(s)),
      }));
    }
    const method = params.get("method");
    if (method) {
      setFilters((f) => ({
        ...f,
        methods: method
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s): s is PaymentMethod => (METHODS as string[]).includes(s)),
      }));
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    setFilters((f) => (f.search === debouncedSearch ? f : { ...f, search: debouncedSearch }));
  }, [debouncedSearch, hydrated]);

  const coursesQuery = useQuery({
    queryKey: ["courses", "options"],
    queryFn: () => mockApi.courses.list(),
    staleTime: 5 * 60_000,
  });
  const courses = React.useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const courseName = React.useCallback(
    (id: string) => courses.find((c) => c.id === id)?.name ?? "—",
    [courses],
  );

  const listFilters = React.useMemo(
    () => ({
      search: filters.search || undefined,
      statuses: filters.statuses.length ? filters.statuses : undefined,
      methods: filters.methods.length ? filters.methods : undefined,
      courseIds: filters.courseIds.length ? filters.courseIds : undefined,
      from: filters.range.from,
      to: filters.range.to,
      sort: { id: "paidAt", desc: true },
      page: 1,
      pageSize: FETCH_SIZE,
    }),
    [filters],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payments", listFilters],
    queryFn: () => mockApi.payments.list(listFilters),
    staleTime: 15_000,
  });
  const summaryQuery = useQuery({
    queryKey: ["payments", "summary"],
    queryFn: () => mockApi.payments.summary(),
    staleTime: 30_000,
  });

  const traineeQuery = useQuery({
    queryKey: ["trainees", "roster-map"],
    queryFn: () => mockApi.trainees.all(),
    staleTime: 60_000,
  });
  const traineeById = React.useMemo(() => {
    const map = new Map<string, { name: string; traineeNo: string }>();
    for (const t of traineeQuery.data ?? []) map.set(t.id, { name: t.name, traineeNo: t.traineeNo });
    return map;
  }, [traineeQuery.data]);

  const recorderName = React.useCallback(
    (id: string) => mockApi.payments.recorderNames[id] ?? "—",
    [],
  );

  const rows = React.useMemo(() => data?.rows ?? [], [data?.rows]);
  const summary = summaryQuery.data;

  const refundMutation = useMutation({
    mutationFn: (id: string) => mockApi.payments.refund(id),
    onSuccess: () => {
      toast.success("Refund recorded", {
        description: "A negative ledger entry was added against the receipt.",
      });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["trainees"] });
    },
    onError: () => toast.error("Could not record the refund."),
  });

  const columns = React.useMemo<ColumnDef<Payment, unknown>[]>(
    () => [
      {
        id: "receipt",
        header: "Receipt",
        accessorFn: (p) => p.receiptNo,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <AvatarInitials
              name={traineeById.get(row.original.traineeId)?.name ?? "?"}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-medium text-ink">
                {row.original.receiptNo}
              </p>
              <p className="truncate text-xs text-ink-3">
                {traineeById.get(row.original.traineeId)?.traineeNo ?? row.original.traineeId}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "trainee",
        header: "Trainee",
        accessorFn: (p) => traineeById.get(p.traineeId)?.name ?? p.traineeId,
        cell: ({ row }) => (
          <span className="truncate text-sm text-ink">
            {traineeById.get(row.original.traineeId)?.name ?? row.original.traineeId}
          </span>
        ),
      },
      {
        id: "course",
        header: "Course",
        accessorFn: (p) => courseName(p.courseId),
        cell: ({ row }) => (
          <span className="text-sm text-ink-2">{courseName(row.original.courseId)}</span>
        ),
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
        accessorFn: (p) => p.reference,
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap text-ink-3">
            {row.original.reference}
          </span>
        ),
      },
      {
        id: "paidAt",
        header: "Date",
        accessorFn: (p) => p.paidAt,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {formatDate(row.original.paidAt)}
          </span>
        ),
      },
      {
        id: "recorder",
        header: "Recorded by",
        accessorFn: (p) => recorderName(p.recordedById),
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {recorderName(row.original.recordedById)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (p) => p.status,
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            label={STATUS_LABEL[row.original.status]}
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
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label={`Print receipt ${row.original.receiptNo}`}
            >
              <Link href={`/payments/${row.original.id}?print=1`}>
                <PrinterIcon className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label={`Open receipt ${row.original.receiptNo}`}
            >
              <Link href={`/payments/${row.original.id}`}>
                <EyeIcon className="size-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [courseName, recorderName, traineeById],
  );

  const chips: Chip[] = React.useMemo(() => {
    const out: Chip[] = [];
    if (filters.statuses.length) {
      out.push({
        id: "status",
        label: "Status",
        value: filters.statuses.map((s) => STATUS_LABEL[s]).join(", "),
        onRemove: () => setFilters((f) => ({ ...f, statuses: [] })),
      });
    }
    if (filters.methods.length) {
      out.push({
        id: "method",
        label: "Method",
        value: filters.methods.map((m) => METHOD_LABEL[m]).join(", "),
        onRemove: () => setFilters((f) => ({ ...f, methods: [] })),
      });
    }
    if (filters.courseIds.length) {
      out.push({
        id: "course",
        label: "Course",
        value:
          filters.courseIds.length === 1
            ? courseName(filters.courseIds[0]!)
            : `${filters.courseIds.length} courses`,
        onRemove: () => setFilters((f) => ({ ...f, courseIds: [] })),
      });
    }
    if (filters.range.from || filters.range.to) {
      out.push({
        id: "date",
        label: "Paid between",
        value: `${filters.range.from ?? "…"} → ${filters.range.to ?? "…"}`,
        onRemove: () => setFilters((f) => ({ ...f, range: {} })),
      });
    }
    return out;
  }, [filters, courseName]);

  const clearAll = () => {
    setSearchDraft("");
    setFilters(EMPTY);
  };

  const collected = summary?.collectedThisMonth ?? 0;
  const lastMonth = summary?.lastMonth ?? 0;
  const changePct = lastMonth > 0 ? Math.round(((collected - lastMonth) / lastMonth) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        subtitle={
          isLoading
            ? "Loading ledger…"
            : `${formatNumber(data?.total ?? 0)} receipt${(data?.total ?? 0) === 1 ? "" : "s"} in the ledger`
        }
        actions={
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/payments/new">
              <PlusIcon className="size-4" />
              Record payment
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Collected this month"
          value={formatRwf(collected)}
          icon={<TrendingUpIcon className="size-4" />}
          changePct={changePct}
          isLoading={summaryQuery.isLoading}
        />
        <StatCard
          label="Outstanding"
          value={formatRwf(summary?.outstanding ?? 0)}
          icon={<WalletIcon className="size-4" />}
          hint="Across all enrolled trainees"
          isLoading={summaryQuery.isLoading}
        />
        <StatCard
          label="Refunds issued"
          value={formatRwf(summary?.refunds ?? 0)}
          icon={<RotateCcwIcon className="size-4" />}
          hint="Lifetime"
          isLoading={summaryQuery.isLoading}
        />
        <StatCard
          label="Receipts this month"
          value={formatNumber(summary?.invoiceCount ?? 0)}
          icon={<CreditCardIcon className="size-4" />}
          isLoading={summaryQuery.isLoading}
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput
              value={searchDraft}
              onValueChange={setSearchDraft}
              placeholder="Search receipt number, reference or trainee…"
              className="lg:max-w-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <MultiSelectFilter
                label="Status"
                width="w-52"
                options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                selected={filters.statuses}
                onChange={(statuses) =>
                  setFilters((f) => ({ ...f, statuses: statuses as typeof f.statuses }))
                }
              />
              <MultiSelectFilter
                label="Method"
                width="w-52"
                options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
                selected={filters.methods}
                onChange={(methods) =>
                  setFilters((f) => ({ ...f, methods: methods as typeof f.methods }))
                }
              />
              <MultiSelectFilter
                label="Course"
                searchable
                width="w-72"
                options={courses.map((c) => ({ value: c.id, label: c.name, hint: c.code }))}
                selected={filters.courseIds}
                onChange={(courseIds) =>
                  setFilters((f) => ({ ...f, courseIds: courseIds as typeof f.courseIds }))
                }
              />
              <DateRangePicker
                value={filters.range}
                onChange={(range) => setFilters((f) => ({ ...f, range }))}
                label="Paid between"
              />
            </div>
          </div>
          <FilterChips chips={chips} onClearAll={clearAll} clearLabel="Reset all filters" />
        </CardContent>
      </Card>

      {isError ? (
        <EmptyState
          title="Could not load payments"
          description="The ledger did not respond. Try again."
          action={
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(p) => p.id}
          isLoading={isLoading}
          onRowClick={(p) => router.push(`/payments/${p.id}`)}
          globalFilter={filters.search}
          pageSize={20}
          emptyState={
            <EmptyState
              title="No receipts match your filters"
              description="Clear the filters or record a new payment."
              action={
                <Button size="sm" variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          }
          bulkActions={(ids) => (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const chosen = rows.filter((p) => ids.includes(p.id));
                  const header = [
                    "receipt_no",
                    "trainee",
                    "trainee_no",
                    "course",
                    "amount_rwf",
                    "method",
                    "reference",
                    "paid_at",
                    "recorded_by",
                    "status",
                    "notes",
                  ];
                  const lines = chosen.map((p) =>
                    [
                      p.receiptNo,
                      traineeById.get(p.traineeId)?.name ?? "",
                      traineeById.get(p.traineeId)?.traineeNo ?? "",
                      courseName(p.courseId),
                      String(p.amountRwf),
                      p.method,
                      p.reference,
                      p.paidAt.slice(0, 10),
                      recorderName(p.recordedById),
                      p.status,
                      p.notes,
                    ]
                      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
                      .join(","),
                  );
                  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
                    type: "text/csv;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `payment-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <DownloadIcon className="size-3.5" />
                Export ledger
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-red"
                onClick={() => {
                  for (const id of ids) refundMutation.mutate(id);
                }}
                disabled={refundMutation.isPending}
              >
                <RotateCcwIcon className="size-3.5" />
                Refund selected
              </Button>
            </>
          )}
        />
      )}
    </div>
  );
}
