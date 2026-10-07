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
  ShieldCheckIcon,
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api/client";
import { formatDate, formatNumber } from "@/lib/utils/format";
import type { CertificateStatus } from "@/lib/types";

/**
 * /certificates — the register.
 *
 * Everything on this page comes from `/api/certificates`. Trainee and course names
 * arrive already joined on the row, and the trainer is shown as the *snapshot* taken
 * at issue time rather than the course's current owner: a certificate in a trainee's
 * hand must read the same today as it did the day it was printed.
 */

const STATUSES: CertificateStatus[] = ["VALID", "REVOKED"];

const STATUS_LABEL: Record<CertificateStatus, string> = {
  VALID: "Valid",
  REVOKED: "Revoked",
};

/** One row of `/api/certificates`, plus the status derived server-side. */
interface CertificateRow {
  id: string;
  courseId: string;
  studentNumber: number;
  verificationToken: string;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  topicsSnapshot: string[];
  durationSnapshot: string;
  trainerNameSnapshot: string;
  trainerTitleSnapshot: string;
  status: CertificateStatus;
  trainee: { id: string; fullName: string; traineeNo: string };
  course: { id: string; code: string; name: string };
}

interface CourseOption {
  id: string;
  code: string;
  name: string;
  trainerId: string | null;
}

interface Filters {
  search: string;
  statuses: CertificateStatus[];
  courseIds: string[];
  range: DateRange;
}

const EMPTY: Filters = { search: "", statuses: [], courseIds: [], range: {} };
const FETCH_SIZE = 50;

export default function CertificatesPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const currentUser = useAuthStore((s) => s.currentUser);
  const isTrainer = role === "TRAINER";

  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [searchDraft, setSearchDraft] = React.useState("");
  const debouncedSearch = useDebounce(searchDraft, 300);
  const [hydrated, setHydrated] = React.useState(false);

  /* Dashboard deep links: /certificates?status=…&course=… */
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
    queryFn: () => api.get<{ items: CourseOption[] }>("/courses", { pageSize: 100 }),
    staleTime: 5 * 60_000,
  });
  const courses = React.useMemo(() => coursesQuery.data?.items ?? [], [coursesQuery.data]);

  /* A trainer only sees their own courses. Scoping happens here rather than being
   * trusted to the server, and the server additionally refuses a trainer asking for
   * someone else's course. */
  const scopeCourseIds = React.useMemo(() => {
    if (!isTrainer || !currentUser?.trainerId) return undefined;
    return courses.filter((c) => c.trainerId === currentUser.trainerId).map((c) => c.id);
  }, [isTrainer, currentUser?.trainerId, courses]);

  const query = React.useMemo(
    () => ({
      search: filters.search || undefined,
      status: filters.statuses.length ? filters.statuses.join(",") : undefined,
      courseIds:
        scopeCourseIds ??
        (filters.courseIds.length ? filters.courseIds.join(",") : undefined),
      issuedFrom: filters.range.from,
      issuedTo: filters.range.to,
      page: 1,
      pageSize: FETCH_SIZE,
    }),
    [filters, scopeCourseIds],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["certificates", query],
    queryFn: () => api.get<{ items: CertificateRow[]; total: number }>("/certificates", query),
    staleTime: 15_000,
  });

  const rows = React.useMemo(() => data?.items ?? [], [data?.items]);

  const courseName = React.useCallback(
    (id: string) => courses.find((c) => c.id === id)?.name ?? "—",
    [courses],
  );

  const counts = React.useMemo(() => {
    const out: Record<CertificateStatus, number> = {
      VALID: 0,
      REVOKED: 0,
    };
    for (const c of rows) out[c.status] += 1;
    return out;
  }, [rows]);

  const columns = React.useMemo<ColumnDef<CertificateRow, unknown>[]>(
    () => [
      {
        id: "studentNumber",
        header: "Certificate",
        accessorFn: (c) => c.studentNumber,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <AvatarInitials name={row.original.trainee.fullName} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-medium text-ink">
                {row.original.studentNumber}
              </p>
              <p className="truncate text-xs text-ink-3">
                {row.original.trainee.traineeNo}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "trainee",
        header: "Trainee",
        accessorFn: (c) => c.trainee.fullName,
        cell: ({ row }) => (
          <span className="truncate text-sm text-ink">{row.original.trainee.fullName}</span>
        ),
      },
      {
        id: "course",
        header: "Course",
        accessorFn: (c) => c.course.name,
        cell: ({ row }) => (
          <span className="text-sm text-ink-2">
            <span className="font-mono text-xs text-ink-3">{row.original.course.code}</span>{" "}
            {row.original.course.name}
          </span>
        ),
      },
      {
        id: "duration",
        header: "Duration",
        accessorFn: (c) => c.durationSnapshot,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {row.original.durationSnapshot}
          </span>
        ),
      },
      {
        id: "trainer",
        header: "Issued by",
        accessorFn: (c) => c.trainerNameSnapshot,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {row.original.trainerNameSnapshot}
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
        id: "status",
        header: "Status",
        accessorFn: (c) => c.status,
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} label={STATUS_LABEL[row.original.status]} />
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
              aria-label={`Download PDF for certificate ${row.original.studentNumber}`}
            >
              <a href={`/api/certificates/${row.original.id}/pdf`} download>
                <DownloadIcon className="size-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label={`Open certificate ${row.original.studentNumber}`}
            >
              <Link href={`/certificates/${row.original.id}`}>
                <EyeIcon className="size-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
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

  const exportCsv = (ids: string[]) => {
    const chosen = ids.length ? rows.filter((c) => ids.includes(c.id)) : rows;
    const header = [
      "student_number",
      "trainee",
      "trainee_no",
      "course_code",
      "course",
      "duration",
      "issued_by",
      "issued_at",
      "status",
      "revoked_at",
      "revoked_reason",
    ];
    /* Quote every field and double any embedded quote: a trainee name containing a
     * comma must not be able to forge a column in the download. */
    const quote = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = chosen.map((c) =>
      [
        c.studentNumber,
        c.trainee.fullName,
        c.trainee.traineeNo,
        c.course.code,
        c.course.name,
        c.durationSnapshot,
        c.trainerNameSnapshot,
        c.issuedAt.slice(0, 10),
        c.status,
        c.revokedAt?.slice(0, 10) ?? "",
        c.revokedReason ?? "",
      ]
        .map(quote)
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
              <Link href="/exams">
                <AwardIcon className="size-4" />
                Send an exam
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
          label="Revoked"
          value={formatNumber(counts.REVOKED)}
          icon={<ShieldCheckIcon className="size-4" />}
          href="/certificates?status=REVOKED"
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput
              value={searchDraft}
              onValueChange={setSearchDraft}
              placeholder="Search student number, trainee or course…"
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
          pageSize={FETCH_SIZE}
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
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportCsv(ids)}>
              <DownloadIcon className="size-3.5" />
              Export register
            </Button>
          )}
        />
      )}
    </div>
  );
}
