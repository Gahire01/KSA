"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ClockIcon, FileQuestionIcon, SendIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MultiSelectFilter } from "@/components/shared/MultiSelectFilter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

/**
 * /exams — the exams the academy runs, and every sitting so far.
 *
 * An "exam" is a course: its paper comes from the course's question bank and is
 * frozen per trainee on their attempt. Both tables read the database.
 */

interface ExamOverviewRow {
  id: string;
  code: string;
  name: string;
  passMarkPct: number;
  maxAttempts: number;
  examDurationMin: number;
  questionCount: number;
  attempts: { total: number; waiting: number; inProgress: number; passed: number; failed: number };
}

interface AttemptRow {
  id: string;
  status: string;
  attemptNumber: number;
  scorePct: number | null;
  blurCount: number;
  submittedAt: string | null;
  createdAt: string;
  trainee: { id: string; fullName: string; traineeNo: string };
  course: { id: string; name: string; code: string };
}

const ATTEMPT_STATUSES = ["PENDING", "STARTED", "SUBMITTED", "PASSED", "FAILED", "VOID"] as const;
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Sent, not opened",
  STARTED: "In progress",
  SUBMITTED: "Not passed",
  PASSED: "Passed",
  FAILED: "Failed",
  VOID: "Void",
};

export default function ExamsPage() {
  const router = useRouter();
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [courseIds, setCourseIds] = React.useState<string[]>([]);

  const overview = useQuery({
    queryKey: ["exams", "overview"],
    queryFn: () => api.get<{ items: ExamOverviewRow[] }>("/exams/overview"),
    staleTime: 30_000,
  });
  const courses = React.useMemo(() => overview.data?.items ?? [], [overview.data]);

  const attemptsQuery = useQuery({
    queryKey: ["exams", "attempts", statuses, courseIds],
    queryFn: () =>
      api.get<{ items: AttemptRow[] }>("/exams", {
        pageSize: 100,
        /* The API filters on one value each; more than one is narrowed client-side below. */
        status: statuses.length === 1 ? statuses[0] : undefined,
        courseId: courseIds.length === 1 ? courseIds[0] : undefined,
      }),
    staleTime: 15_000,
  });
  const attempts = React.useMemo(
    () =>
      (attemptsQuery.data?.items ?? []).filter(
        (a) =>
          (statuses.length === 0 || statuses.includes(a.status)) &&
          (courseIds.length === 0 || courseIds.includes(a.course.id)),
      ),
    [attemptsQuery.data, statuses, courseIds],
  );

  const courseColumns = React.useMemo<ColumnDef<ExamOverviewRow, unknown>[]>(
    () => [
      {
        id: "course",
        header: "Exam",
        accessorFn: (c) => c.name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{row.original.name}</p>
            <p className="font-mono text-xs text-ink-3">{row.original.code}</p>
          </div>
        ),
      },
      {
        id: "questions",
        header: "Questions",
        accessorFn: (c) => c.questionCount,
        cell: ({ row }) =>
          row.original.questionCount === 0 ? (
            <span className="text-sm text-amber">None yet</span>
          ) : (
            <span className="text-sm tabular text-ink">{formatNumber(row.original.questionCount)}</span>
          ),
      },
      {
        id: "rules",
        header: "Rules",
        accessorFn: (c) => c.examDurationMin,
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 text-sm whitespace-nowrap text-ink-2">
            <ClockIcon className="size-3.5" />
            {row.original.examDurationMin} min · pass {row.original.passMarkPct}% · {row.original.maxAttempts} attempts
          </span>
        ),
      },
      {
        id: "attempts",
        header: "Sittings",
        accessorFn: (c) => c.attempts.total,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2 tabular">
            {row.original.attempts.total} · {row.original.attempts.passed} passed ·{" "}
            {row.original.attempts.failed} not passed
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/exams/${row.original.id}`}>
                <FileQuestionIcon className="size-3.5" />
                Question bank
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/exams/new?courseId=${row.original.id}`}>
                <SendIcon className="size-3.5" />
                Send exam
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const attemptColumns = React.useMemo<ColumnDef<AttemptRow, unknown>[]>(
    () => [
      {
        id: "trainee",
        header: "Trainee",
        accessorFn: (a) => a.trainee.fullName,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <AvatarInitials name={row.original.trainee.fullName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{row.original.trainee.fullName}</p>
              <p className="font-mono text-xs text-ink-3">{row.original.trainee.traineeNo}</p>
            </div>
          </div>
        ),
      },
      {
        id: "course",
        header: "Course",
        accessorFn: (a) => a.course.name,
        cell: ({ row }) => <span className="text-sm text-ink-2">{row.original.course.name}</span>,
      },
      {
        id: "attempt",
        header: "Attempt",
        accessorFn: (a) => a.attemptNumber,
        cell: ({ row }) => <span className="text-sm tabular text-ink-2">#{row.original.attemptNumber}</span>,
      },
      {
        id: "score",
        header: "Score",
        accessorFn: (a) => a.scorePct ?? -1,
        cell: ({ row }) => (
          <span className="text-sm tabular text-ink">
            {row.original.scorePct === null ? "—" : `${row.original.scorePct}%`}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (a) => a.status,
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} label={STATUS_LABEL[row.original.status]} size="sm" />
        ),
      },
      {
        id: "leaves",
        header: "Window left",
        accessorFn: (a) => a.blurCount,
        cell: ({ row }) =>
          row.original.blurCount > 0 ? (
            <span className="text-sm font-medium text-amber tabular">{row.original.blurCount}×</span>
          ) : (
            <span className="text-sm text-ink-3">—</span>
          ),
      },
      {
        id: "when",
        header: "When",
        accessorFn: (a) => a.submittedAt ?? a.createdAt,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {formatDateTime(row.original.submittedAt ?? row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Exams"
        subtitle="Each course is one exam. Manage its questions, send it to trainees and review every sitting."
        actions={
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/exams/new">
              <SendIcon className="size-4" />
              Send an exam
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses">Exams</TabsTrigger>
          <TabsTrigger value="attempts">All sittings</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-4">
          <DataTable
            columns={courseColumns}
            data={courses}
            isLoading={overview.isLoading}
            getRowId={(c) => c.id}
            onRowClick={(c) => router.push(`/exams/${c.id}`)}
            hideFooter
            emptyState={
              <EmptyState title="No courses yet" description="Add a course, then build its question bank." />
            }
          />
        </TabsContent>

        <TabsContent value="attempts" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              label="Status"
              options={ATTEMPT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s }))}
              selected={statuses}
              onChange={setStatuses}
            />
            <MultiSelectFilter
              label="Course"
              options={courses.map((c) => ({ value: c.id, label: c.name }))}
              selected={courseIds}
              onChange={setCourseIds}
            />
          </div>
          <DataTable
            columns={attemptColumns}
            data={attempts}
            isLoading={attemptsQuery.isLoading}
            getRowId={(a) => a.id}
            onRowClick={(a) => router.push(`/exams/${a.course.id}/attempts/${a.id}`)}
            emptyState={
              <EmptyState
                title="No sittings yet"
                description="Once an exam is sent and opened, every sitting shows here."
              />
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
