"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BookOpenIcon,
  CircleDollarSignIcon,
  ClockIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { MultiSelectFilter } from "@/components/shared/MultiSelectFilter";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { mockApi } from "@/lib/mock";
import { useAuthStore } from "@/lib/stores/auth-store";
import { categoryLabel, formatDurationLabel, formatNumber, formatRwf } from "@/lib/utils/format";
import { CATEGORIES } from "@/lib/types";
import type { Course } from "@/lib/types";

export default function CoursesPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const canManage = role === "OWNER" || role === "ADMIN";

  const [search, setSearch] = React.useState("");
  const debounced = useDebounce(search, 200);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [activeOnly, setActiveOnly] = React.useState(false);

  const coursesQuery = useQuery({
    queryKey: ["courses", "list"],
    queryFn: () => mockApi.courses.list(),
    staleTime: 60_000,
  });
  const trainersQuery = useQuery({
    queryKey: ["trainers", "options"],
    queryFn: () => mockApi.trainers.list(),
    staleTime: 5 * 60_000,
    enabled: canManage,
  });

  const trainerName = React.useCallback(
    (id: string) => trainersQuery.data?.find((t) => t.id === id)?.name ?? "—",
    [trainersQuery.data],
  );

  const rows = React.useMemo(() => {
    const all = coursesQuery.data ?? [];
    const q = debounced.trim().toLowerCase();
    return all.filter((c) => {
      if (activeOnly && !c.isActive) return false;
      if (categories.length && !categories.includes(c.category)) return false;
      if (q) {
        return (
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [coursesQuery.data, debounced, categories, activeOnly]);

  const columns = React.useMemo<ColumnDef<Course, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Course",
        accessorFn: (c) => c.name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.original.name}</p>
            <p className="truncate font-mono text-xs text-ink-3">{row.original.code}</p>
          </div>
        ),
      },
      {
        id: "category",
        header: "Category",
        accessorFn: (c) => c.category,
        cell: ({ row }) => (
          <Badge variant="outline">{categoryLabel(row.original.category)}</Badge>
        ),
      },
      {
        id: "duration",
        header: "Duration",
        accessorFn: (c) => c.durationValue,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {formatDurationLabel(row.original.durationValue, row.original.durationUnit)}
          </span>
        ),
      },
      {
        id: "price",
        header: "Fee",
        accessorFn: (c) => c.priceRwf,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap tabular text-ink">
            {formatRwf(row.original.priceRwf)}
          </span>
        ),
      },
      {
        id: "questions",
        header: "Questions",
        accessorFn: (c) => c.questionCount,
        cell: ({ row }) => (
          <span className="text-sm tabular text-ink-2">
            {formatNumber(row.original.questionCount)}
          </span>
        ),
      },
      {
        id: "enrolled",
        header: "Enrolled",
        accessorFn: (c) => c.enrolledCount,
        cell: ({ row }) => (
          <span className="text-sm tabular text-ink-2">
            {formatNumber(row.original.enrolledCount)}
          </span>
        ),
      },
      {
        id: "trainer",
        header: "Lead trainer",
        accessorFn: (c) => trainerName(c.trainerId),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <AvatarInitials name={trainerName(row.original.trainerId)} size="xs" />
            <span className="truncate text-sm text-ink-2">
              {trainerName(row.original.trainerId)}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (c) => (c.isActive ? 1 : 0),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "green" : "neutral"}>
            {row.original.isActive ? "Active" : "Archived"}
          </Badge>
        ),
      },
    ],
    [trainerName],
  );

  const totalEnrolled = rows.reduce((s, c) => s + c.enrolledCount, 0);
  const avgQuestions = rows.length
    ? Math.round(rows.reduce((s, c) => s + c.questionCount, 0) / rows.length)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Courses"
        subtitle={
          coursesQuery.isLoading
            ? "Loading catalogue…"
            : `${rows.length} course${rows.length === 1 ? "" : "s"} · ${formatNumber(totalEnrolled)} enrolments`
        }
        actions={
          canManage ? (
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/courses/new">
                <PlusIcon className="size-4" />
                New course
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search courses by name or code…"
          className="sm:max-w-xs"
        />
        <MultiSelectFilter
          label="Category"
          options={CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))}
          selected={categories}
          onChange={setCategories}
          width="w-60"
        />
        <Button
          variant={activeOnly ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={() => setActiveOnly((v) => !v)}
          aria-pressed={activeOnly}
        >
          Active only
        </Button>
        {search || categories.length || activeOnly ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => {
              setSearch("");
              setCategories([]);
              setActiveOnly(false);
            }}
          >
            Reset
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          icon={<BookOpenIcon className="size-4" />}
          label="Courses listed"
          value={formatNumber(rows.length)}
        />
        <SummaryTile
          icon={<UsersIcon className="size-4" />}
          label="Total enrolments"
          value={formatNumber(totalEnrolled)}
        />
        <SummaryTile
          icon={<CircleDollarSignIcon className="size-4" />}
          label="Average fee"
          value={
            rows.length
              ? formatRwf(Math.round(rows.reduce((s, c) => s + c.priceRwf, 0) / rows.length))
              : "—"
          }
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(c) => c.id}
        isLoading={coursesQuery.isLoading}
        onRowClick={(c) => router.push(`/courses/${c.id}`)}
        pageSize={12}
        stickyHeader={false}
        globalFilter={search}
        emptyState={
          <EmptyState
            title="No courses match"
            description="Adjust the filters, or create a new course to get started."
            action={
              canManage ? (
                <Button asChild size="sm">
                  <Link href="/courses/new">New course</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <p className="flex items-center gap-1.5 text-xs text-ink-3">
        <ClockIcon className="size-3.5" />
        Average question bank depth: {formatNumber(avgQuestions)} questions per course.
      </p>
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-sm">
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-lg bg-muted text-ink-2"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold tracking-wider text-ink-2 uppercase">
          {label}
        </span>
        <span className="block font-display text-lg font-semibold text-ink tabular">
          {value}
        </span>
      </span>
    </div>
  );
}
