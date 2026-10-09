"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  MailIcon,
  PlusIcon,
  SendIcon,
  UploadIcon,
  WalletIcon,
} from "lucide-react";

import { ExportMenu } from "@/components/shared/ExportMenu";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { FilterChips, type Chip } from "@/components/shared/FilterChips";
import { MultiSelectFilter } from "@/components/shared/MultiSelectFilter";
import { DateRangePicker, type DateRange } from "@/components/shared/DateRangePicker";
import { DataTable } from "@/components/shared/DataTable";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useCategories, useCategoryOptions, useCourses, useTrainees } from "@/lib/api/hooks";
import { useAuthStore } from "@/lib/stores/auth-store";
import { categoryLabel, formatDate, formatNumber, formatRwf } from "@/lib/utils/format";
import type { EnrollmentStatus } from "@/lib/api/types";
import type { Category, Country, PaymentStatus, Trainee } from "@/lib/types";
import { COUNTRIES } from "@/lib/types";

/* Query page size: fetch the filtered set and paginate client-side.
 * Capped at the API's MAX_PAGE_SIZE; a larger single request is rejected.
 * See progress.md — server-side pagination lands in Phase 2. */
const FETCH_SIZE = 100;

/* Courses for the filter/select dropdowns — also bounded by MAX_PAGE_SIZE. */
const COURSE_OPTION_LIMIT = 100;

const ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  "ACTIVE",
  "PENDING",
  "COMPLETED",
  "FAILED",
  "WITHDRAWN",
];

const PAYMENT_STATUSES: PaymentStatus[] = ["PAID", "PARTIAL", "UNPAID"];

const ENROLLMENT_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  COMPLETED: "Completed",
  SUSPENDED: "Suspended",
  FAILED: "Failed",
  WITHDRAWN: "Withdrawn",
};

const PAYMENT_LABEL: Record<string, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  UNPAID: "Unpaid",
};

interface Filters {
  search: string;
  categories: Category[];
  courseIds: string[];
  statuses: EnrollmentStatus[];
  paymentStatuses: PaymentStatus[];
  countries: Country[];
  range: DateRange;
}

const EMPTY: Filters = {
  search: "",
  categories: [],
  courseIds: [],
  statuses: [],
  paymentStatuses: [],
  countries: [],
  range: {},
};

export default function TraineesPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const currentUser = useAuthStore((s) => s.currentUser);
  const isTrainer = role === "TRAINER";

  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [searchDraft, setSearchDraft] = React.useState("");
  const debouncedSearch = useDebounce(searchDraft, 300);
  const [hydrated, setHydrated] = React.useState(false);

  /* Seed filters from the query string once (dashboard deep links). */
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statuses = params.get("statuses");
    if (statuses) {
      setFilters((f) => ({
        ...f,
        statuses: statuses
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s): s is EnrollmentStatus =>
            (ENROLLMENT_STATUSES as string[]).includes(s),
          ),
      }));
    }
    const payment = params.get("paymentStatuses");
    if (payment) {
      setFilters((f) => ({
        ...f,
        paymentStatuses: payment
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s): s is PaymentStatus => (PAYMENT_STATUSES as string[]).includes(s)),
      }));
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    setFilters((f) => (f.search === debouncedSearch ? f : { ...f, search: debouncedSearch }));
  }, [debouncedSearch, hydrated]);

  const coursesQuery = useCourses({ page: 1, pageSize: COURSE_OPTION_LIMIT });
  const categoriesQuery = useCategories();
  const categoryOptions = useCategoryOptions();

  const courses = React.useMemo(
    () => coursesQuery.data?.items ?? [],
    [coursesQuery.data],
  );

  /* Trainers only see their own cohorts. */
  const scopeCourseIds = React.useMemo(() => {
    if (!isTrainer || !currentUser?.trainerId) return undefined;
    return courses
      .filter((c) => c.trainerId === currentUser.trainerId)
      .map((c) => c.id);
  }, [isTrainer, currentUser?.trainerId, courses]);

  /* The UI filters categories by name; the database keys on id. */
  const categoryIdsForNames = React.useCallback(
    (names: Category[]) =>
      names
        .map((n) => categoryOptions.find((c) => c.name === n)?.id)
        .filter((id): id is string => Boolean(id)),
    [categoryOptions],
  );

  const listFilters = React.useMemo(
    () => ({
      search: filters.search || undefined,
      categoryId: categoryIdsForNames(filters.categories),
      /* An empty trainer scope must mean "none", not "every course". */
      courseId: isTrainer
        ? scopeCourseIds ?? []
        : filters.courseIds.length
          ? filters.courseIds
          : undefined,
      status: filters.statuses.length ? filters.statuses : undefined,
      paymentStatus: filters.paymentStatuses.length ? filters.paymentStatuses : undefined,
      country: filters.countries.length ? filters.countries : undefined,
      enrolledFrom: filters.range.from,
      enrolledTo: filters.range.to,
      page: 1,
      pageSize: FETCH_SIZE,
    }),
    [filters, categoryIdsForNames, isTrainer, scopeCourseIds],
  );

  /* Skip the request entirely while a trainer scope resolves to nothing. */
  const noVisibleRows = isTrainer && scopeCourseIds?.length === 0;

  const { data, isLoading, isFetching, isError, refetch } = useTrainees(listFilters, {
    enabled: !noVisibleRows,
  });

  const rows = noVisibleRows ? [] : (data?.items ?? []);

  const courseName = React.useCallback(
    (id: string) => courses.find((c) => c.id === id)?.name ?? "—",
    [courses],
  );

  const columns = React.useMemo<ColumnDef<Trainee, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Trainee",
        accessorFn: (t) => t.name,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <AvatarInitials name={row.original.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{row.original.name}</p>
              <p className="truncate font-mono text-xs text-ink-3">
                {row.original.traineeNo}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "course",
        header: "Course",
        accessorFn: (t) => courseName(t.courseId),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">
              {courseName(row.original.courseId)}
            </p>
            <p className="truncate text-xs text-ink-3">
              {categoryLabel(row.original.category)} · {row.original.country}
            </p>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (t) => t.status,
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            label={ENROLLMENT_LABEL[row.original.status]}
          />
        ),
      },
      {
        id: "payment",
        header: "Payment",
        accessorFn: (t) => t.paymentStatus,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <StatusBadge
              status={row.original.paymentStatus}
              label={PAYMENT_LABEL[row.original.paymentStatus]}
              size="sm"
            />
            <p className="text-xs text-ink-3 tabular">
              {formatRwf(row.original.amountPaidRwf)} / {formatRwf(row.original.totalDueRwf)}
            </p>
          </div>
        ),
      },
      {
        id: "deadline",
        header: "Deadline",
        accessorFn: (t) => t.deadline,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {formatDate(row.original.deadline)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button asChild variant="ghost" size="icon-sm" aria-label={`Email ${row.original.name}`}>
              <a href={`mailto:${row.original.email}`}>
                <MailIcon className="size-4" />
              </a>
            </Button>
            <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${row.original.name}`}>
              <Link href={`/trainees/${row.original.id}`}>
                <PlusIcon className="size-4 rotate-45" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [courseName],
  );

  const chips: Chip[] = React.useMemo(() => {
    const out: Chip[] = [];
    if (filters.categories.length) {
      out.push({
        id: "cat",
        label: "Category",
        value: filters.categories.map(categoryLabel).join(", "),
        onRemove: () => setFilters((f) => ({ ...f, categories: [] })),
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
    if (filters.statuses.length) {
      out.push({
        id: "status",
        label: "Status",
        value: filters.statuses.map((s) => ENROLLMENT_LABEL[s] ?? s).join(", "),
        onRemove: () => setFilters((f) => ({ ...f, statuses: [] })),
      });
    }
    if (filters.paymentStatuses.length) {
      out.push({
        id: "pay",
        label: "Payment",
        value: filters.paymentStatuses.map((s) => PAYMENT_LABEL[s] ?? s).join(", "),
        onRemove: () => setFilters((f) => ({ ...f, paymentStatuses: [] })),
      });
    }
    if (filters.countries.length) {
      out.push({
        id: "country",
        label: "Country",
        value: filters.countries.join(", "),
        onRemove: () => setFilters((f) => ({ ...f, countries: [] })),
      });
    }
    if (filters.range.from || filters.range.to) {
      out.push({
        id: "date",
        label: "Enrolled",
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
        title="Trainees"
        subtitle={
          isLoading
            ? "Loading roster…"
            : `${formatNumber(data?.total ?? 0)} trainee${(data?.total ?? 0) === 1 ? "" : "s"} match the current filters`
        }
        actions={
          <>
            {!isTrainer ? (
              <ExportMenu
                type="trainee-roster"
                params={{ courseIds: filters.courseIds, statuses: filters.statuses }}
              />
            ) : null}
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/trainees/import">
                <UploadIcon className="size-4" />
                Import CSV
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/trainees/new">
                <PlusIcon className="size-4" />
                Add trainee
              </Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput
              value={searchDraft}
              onValueChange={setSearchDraft}
              placeholder="Search name, email, ID or phone…"
              className="lg:max-w-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <MultiSelectFilter
                label="Course"
                searchable
                width="w-72"
                options={courses.map((c) => ({
                  value: c.id,
                  label: c.name,
                  hint: c.code,
                }))}
                selected={filters.courseIds}
                onChange={(courseIds) =>
                  setFilters((f) => ({ ...f, courseIds: courseIds as typeof f.courseIds }))
                }
              />
              <MultiSelectFilter
                label="Category"
                width="w-60"
                options={categoriesQuery.data?.map((c) => ({
                  value: c.name as Category,
                  label: categoryLabel(c.name as Category),
                })) ?? []}
                selected={filters.categories}
                onChange={(categories) =>
                  setFilters((f) => ({
                    ...f,
                    categories: categories as typeof f.categories,
                  }))
                }
              />
              <MultiSelectFilter
                label="Status"
                width="w-56"
                options={ENROLLMENT_STATUSES.map((s) => ({
                  value: s,
                  label: ENROLLMENT_LABEL[s] ?? s,
                }))}
                selected={filters.statuses}
                onChange={(statuses) =>
                  setFilters((f) => ({
                    ...f,
                    statuses: statuses as typeof f.statuses,
                  }))
                }
              />
              {!isTrainer ? (
                <MultiSelectFilter
                  label="Payment"
                  width="w-52"
                  options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_LABEL[s]! }))}
                  selected={filters.paymentStatuses}
                  onChange={(paymentStatuses) =>
                    setFilters((f) => ({
                      ...f,
                      paymentStatuses: paymentStatuses as typeof f.paymentStatuses,
                    }))
                  }
                />
              ) : null}
              <MultiSelectFilter
                label="Country"
                width="w-48"
                options={COUNTRIES.map((c) => ({ value: c, label: c }))}
                selected={filters.countries}
                onChange={(countries) =>
                  setFilters((f) => ({
                    ...f,
                    countries: countries as typeof f.countries,
                  }))
                }
              />
              <DateRangePicker
                value={filters.range}
                onChange={(range) => setFilters((f) => ({ ...f, range }))}
                label="Enrolled between"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterChips
              chips={chips}
              onClearAll={clearAll}
              clearLabel="Reset all filters"
            />
            {isFetching && !isLoading ? (
              <span className="text-xs text-ink-3" role="status">
                Updating…
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <EmptyState
          title="Could not load trainees"
          description="The server did not respond. Try again."
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
          getRowId={(t) => t.id}
          isLoading={isLoading}
          enableSelection
          onRowClick={(t) => router.push(`/trainees/${t.id}`)}
          globalFilter={filters.search}
          pageSize={20}
          stickyHeader={false}
          emptyState={
            <EmptyState
              title="No trainees match your filters"
              description="Adjust the filters above, or clear them to see the full roster."
              action={
                <Button size="sm" variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          }
          bulkActions={() => (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <Link href="/exams/new">
                  <SendIcon className="size-3.5" />
                  Send an exam
                </Link>
              </Button>
              {!isTrainer ? (
                <Button size="sm" variant="outline" className="gap-1.5" asChild>
                  <Link href="/payments/new">
                    <WalletIcon className="size-3.5" />
                    Record payment
                  </Link>
                </Button>
              ) : null}
            </>
          )}
        />
      )}
    </div>
  );
}
