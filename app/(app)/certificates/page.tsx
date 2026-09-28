"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AwardIcon,
  BadgeCheckIcon,
  DownloadIcon,
  EyeIcon,
  PrinterIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldXIcon,
} from "lucide-react";

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
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDate, formatNumber } from "@/lib/utils/format";
import type { Certificate, CertificateStatus } from "@/lib/types";

const FETCH_SIZE = 500;

const STATUSES: CertificateStatus[] = ["VALID", "EXPIRING", "EXPIRED", "REVOKED"];

const STATUS_LABEL: Record<CertificateStatus, string> = {
  VALID: "Valid",
  EXPIRING: "Expiring soon",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};

interface Filters {
  search: string;
  statuses: CertificateStatus[];
  courseIds: string[];
  range: DateRange;
}

const EMPTY: Filters = { search: "", statuses: [], courseIds: [], range: {} };

export default function CertificatesPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const currentUser = useAuthStore((s) => s.currentUser);
  const isTrainer = role === "TRAINER";

  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [searchDraft, setSearchDraft] = React.useState("");
  const debouncedSearch = useDebounce(searchDraft, 300);
  const [hydrated, setHydrated] = React.useState(false);

  /* Dashboard deep links: /certificates?status=EXPIRING,EXPIRED */
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status) {
      setFilters((f) => ({
        ...f,
        statuses: status
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s): s is CertificateStatus => (STATUSES as string[]).includes(s)),
      }));
    }
    const course = params.get("course");
    if (course) setFilters((f) => ({ ...f, courseIds: [course] }));
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

  const scopeCourseIds = React.useMemo(() => {
    if (!isTrainer || !currentUser?.trainerId) return undefined;
    return courses.filter((c) => c.trainerId === currentUser.trainerId).map((c) => c.id);
  }, [isTrainer, currentUser?.trainerId, courses]);

  const listFilters = React.useMemo(
    () => ({
      search: filters.search || undefined,
      statuses: filters.statuses.length ? filters.statuses : undefined,
      courseIds: filters.courseIds.length ? filters.courseIds : undefined,
      issuedFrom: filters.range.from,
      issuedTo: filters.range.to,
      sort: { id: "issuedAt", desc: true },
      page: 1,
      pageSize: FETCH_SIZE,
    }),
    [filters],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["certificates", listFilters, scopeCourseIds ?? "all"],
    queryFn: () => mockApi.certificates.list(listFilters, scopeCourseIds),
    staleTime: 15_000,
  });

  const rows = React.useMemo(() => data?.rows ?? [], [data?.rows]);

  const traineeQuery = useQuery({
    queryKey: ["trainees", "roster-map"],
    queryFn: () => mockApi.trainees.all(scopeCourseIds),
    staleTime: 60_000,
  });
  const traineeById = React.useMemo(() => {
    const map = new Map<string, { name: string; traineeNo: string }>();
    for (const t of traineeQuery.data ?? []) map.set(t.id, { name: t.name, traineeNo: t.traineeNo });
    return map;
  }, [traineeQuery.data]);

  const trainerQuery = useQuery({
    queryKey: ["trainers", "options"],
    queryFn: () => mockApi.trainers.list(),
    staleTime: 5 * 60_000,
  });
  const trainerName = React.useCallback(
    (id: string) => trainerQuery.data?.find((t) => t.id === id)?.name ?? "—",
    [trainerQuery.data],
  );
  const courseName = React.useCallback(
    (id: string) => courses.find((c) => c.id === id)?.name ?? "—",
    [courses],
  );

  const counts = React.useMemo(() => {
    const out: Record<CertificateStatus, number> = {
      VALID: 0,
      EXPIRING: 0,
      EXPIRED: 0,
      REVOKED: 0,
    };
    for (const c of rows) out[c.status] += 1;
    return out;
  }, [rows]);

  const expiringSoon = React.useMemo(
    () => rows.filter((c) => c.status === "EXPIRING").slice(0, 5),
    [rows],
  );

  const columns = React.useMemo<ColumnDef<Certificate, unknown>[]>(
    () => [
      {
        id: "certNo",
        header: "Certificate",
        accessorFn: (c) => c.certNo,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <AvatarInitials
              name={traineeById.get(row.original.traineeId)?.name ?? "?"}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-medium text-ink">
                {row.original.certNo}
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
        accessorFn: (c) => traineeById.get(c.traineeId)?.name ?? c.traineeId,
        cell: ({ row }) => (
          <span className="truncate text-sm text-ink">
            {traineeById.get(row.original.traineeId)?.name ?? row.original.traineeId}
          </span>
        ),
      },
      {
        id: "course",
        header: "Course",
        accessorFn: (c) => courseName(c.courseId),
        cell: ({ row }) => (
          <span className="text-sm text-ink-2">{courseName(row.original.courseId)}</span>
        ),
      },
      {
        id: "score",
        header: "Score",
        accessorFn: (c) => c.score,
        cell: ({ row }) => (
          <span className="text-sm tabular text-ink-2">{row.original.score}%</span>
        ),
      },
      {
        id: "trainer",
        header: "Trainer",
        accessorFn: (c) => trainerName(c.trainerId),
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {trainerName(row.original.trainerId)}
          </span>
        ),
      },
      {
        id: "issuedAt",
        header: "Issued",
        accessorFn: (c) => c.issuedAt,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {formatDate(row.original.issuedAt)}
          </span>
        ),
      },
      {
        id: "expiresAt",
        header: "Expires",
        accessorFn: (c) => c.expiresAt ?? "9999",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {row.original.expiresAt ? formatDate(row.original.expiresAt) : "No expiry"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (c) => c.status,
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            label={STATUS_LABEL[row.original.status]}
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
              aria-label={`Print ${row.original.certNo}`}
            >
              <Link href={`/certificates/${row.original.id}?print=1`}>
                <PrinterIcon className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label={`Open ${row.original.certNo}`}
            >
              <Link href={`/certificates/${row.original.id}`}>
                <EyeIcon className="size-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [courseName, traineeById, trainerName],
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
        label: "Issued between",
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Certificates"
        subtitle={
          isLoading
            ? "Loading register…"
            : `${formatNumber(data?.total ?? 0)} certificate${(data?.total ?? 0) === 1 ? "" : "s"} in the register`
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/verify">
                <BadgeCheckIcon className="size-4" />
                Verify a certificate
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/trainees">
                <AwardIcon className="size-4" />
                Issue from a trainee
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Valid"
          value={formatNumber(counts.VALID)}
          icon={<ShieldCheckIcon className="size-4" />}
          href="/certificates?status=VALID"
        />
        <StatCard
          label="Expiring in 30 days"
          value={formatNumber(counts.EXPIRING)}
          icon={<ShieldAlertIcon className="size-4" />}
          href="/certificates?status=EXPIRING"
        />
        <StatCard
          label="Expired"
          value={formatNumber(counts.EXPIRED)}
          icon={<ShieldXIcon className="size-4" />}
          href="/certificates?status=EXPIRED"
        />
        <StatCard
          label="Revoked"
          value={formatNumber(counts.REVOKED)}
          icon={<ShieldAlertIcon className="size-4" />}
          href="/certificates?status=REVOKED"
        />
      </div>

      {expiringSoon.length > 0 ? (
        <Card className="border-amber/40 bg-amber-bg">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <ShieldAlertIcon className="size-5 shrink-0 text-amber" />
            <p className="flex-1 text-sm text-ink-2">
              <span className="font-semibold text-ink">
                {counts.EXPIRING} certificate{counts.EXPIRING === 1 ? "" : "s"} expire within 30
                days.
              </span>{" "}
              {expiringSoon
                .slice(0, 3)
                .map((c) => traineeById.get(c.traineeId)?.name ?? c.certNo)
                .join(", ")}
              {expiringSoon.length > 3 ? " and others" : ""} should renew.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setFilters((f) => ({ ...f, statuses: ["EXPIRING"] }))}
            >
              <DownloadIcon className="size-4" />
              Show expiring
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput
              value={searchDraft}
              onValueChange={setSearchDraft}
              placeholder="Search certificate number, trainee or course…"
              className="lg:max-w-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <MultiSelectFilter
                label="Status"
                width="w-56"
                options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                selected={filters.statuses}
                onChange={(statuses) =>
                  setFilters((f) => ({ ...f, statuses: statuses as typeof f.statuses }))
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
                label="Issued between"
              />
            </div>
          </div>
          <FilterChips chips={chips} onClearAll={clearAll} clearLabel="Reset all filters" />
        </CardContent>
      </Card>

      {isError ? (
        <EmptyState
          title="Could not load certificates"
          description="The register did not respond. Try again."
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
          getRowId={(c) => c.id}
          isLoading={isLoading}
          onRowClick={(c) => router.push(`/certificates/${c.id}`)}
          globalFilter={filters.search}
          pageSize={20}
          emptyState={
            <EmptyState
              title="No certificates match your filters"
              description="Clear the filters to see the full register."
              action={
                <Button size="sm" variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          }
          bulkActions={(ids) => (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                const chosen = rows.filter((c) => ids.includes(c.id));
                const header = [
                  "cert_no",
                  "trainee",
                  "trainee_no",
                  "course",
                  "score",
                  "trainer",
                  "issued_at",
                  "expires_at",
                  "status",
                ];
                const lines = chosen.map((c) =>
                  [
                    c.certNo,
                    traineeById.get(c.traineeId)?.name ?? "",
                    traineeById.get(c.traineeId)?.traineeNo ?? "",
                    courseName(c.courseId),
                    String(c.score),
                    trainerName(c.trainerId),
                    c.issuedAt.slice(0, 10),
                    c.expiresAt?.slice(0, 10) ?? "",
                    c.status,
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
                a.download = `certificate-register-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <DownloadIcon className="size-3.5" />
              Export register
            </Button>
          )}
        />
      )}
    </div>
  );
}
