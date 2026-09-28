"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClockIcon,
  FlagIcon,
  PlusIcon,
  SendIcon,
  UsersIcon,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { MultiSelectFilter } from "@/components/shared/MultiSelectFilter";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { mockApi } from "@/lib/mock";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/utils/format";
import type { Exam, ExamAttempt } from "@/lib/types";

const EXAM_STATUS = ["ACTIVE", "SCHEDULED", "COMPLETED", "DRAFT"] as const;
const ATTEMPT_STATUSES = [
  "SENT",
  "STARTED",
  "SUBMITTED",
  "PASSED",
  "FAILED",
  "VOID",
] as const;

const EXAM_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  DRAFT: "Draft",
};

export default function ExamsPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const role = currentUser?.role ?? "ADMIN";
  const isTrainer = role === "TRAINER";
  const canSchedule = role === "OWNER" || role === "ADMIN";

  const [search, setSearch] = React.useState("");
  const debounced = useDebounce(search, 250);
  const [examStatuses, setExamStatuses] = React.useState<string[]>([]);
  const [attemptStatuses, setAttemptStatuses] = React.useState<string[]>([]);
  const [flaggedOnly, setFlaggedOnly] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  /* Dashboard deep links: /exams?filter=flagged or ?status=ACTIVE */
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("filter") === "flagged") setFlaggedOnly(true);
    const status = params.get("status");
    if (status && EXAM_STATUS_LABEL[status]) setExamStatuses([status]);
    setHydrated(true);
  }, []);
  void hydrated;

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

  const examsQuery = useQuery({
    queryKey: ["exams", debounced, examStatuses, scopeCourseIds ?? "all"],
    queryFn: () =>
      mockApi.exams.list(
        {
          search: debounced || undefined,
          status: examStatuses.length === 1 ? examStatuses[0] : undefined,
        },
        scopeCourseIds,
      ),
    enabled: coursesQuery.isSuccess,
  });

  const attemptsQuery = useQuery({
    queryKey: ["attempts", attemptStatuses, flaggedOnly, debounced],
    queryFn: () =>
      mockApi.attempts.list({
        statuses: attemptStatuses as never,
        flaggedOnly: flaggedOnly || undefined,
        search: debounced || undefined,
      }),
  });

  const attempts = React.useMemo(() => {
    const rows = attemptsQuery.data ?? [];
    if (!scopeCourseIds || scopeCourseIds.length === 0) return rows;
    return rows.filter((a) => scopeCourseIds.includes(a.courseId));
  }, [attemptsQuery.data, scopeCourseIds]);
  const exams = React.useMemo(
    () =>
      (examsQuery.data ?? []).filter(
        (e) => examStatuses.length === 0 || examStatuses.includes(e.status),
      ),
    [examsQuery.data, examStatuses],
  );

  const courseName = React.useCallback(
    (id: string) => courses.find((c) => c.id === id)?.name ?? "—",
    [courses],
  );

  /* Attempt rows only carry trainee ids, so resolve names from the roster. */
  const rosterQuery = useQuery({
    queryKey: ["trainees", "roster-map"],
    queryFn: () => mockApi.trainees.all(scopeCourseIds),
    staleTime: 60_000,
  });
  const nameById = React.useMemo(() => {
    const map = new Map<string, { name: string; traineeNo: string }>();
    for (const t of rosterQuery.data ?? []) map.set(t.id, { name: t.name, traineeNo: t.traineeNo });
    return map;
  }, [rosterQuery.data]);

  const traineeName = React.useCallback((id: string) => nameById.get(id)?.name ?? id, [nameById]);
  const traineeNo = React.useCallback(
    (id: string) => nameById.get(id)?.traineeNo ?? "—",
    [nameById],
  );

  const examColumns = React.useMemo<ColumnDef<Exam, unknown>[]>(
    () => [
      {
        id: "title",
        header: "Exam",
        accessorFn: (e) => e.title,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.original.title}</p>
            <p className="truncate text-xs text-ink-2">{courseName(row.original.courseId)}</p>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (e) => e.status,
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status === "ACTIVE" ? "active" : row.original.status.toLowerCase()}
            label={EXAM_STATUS_LABEL[row.original.status]}
          />
        ),
      },
      {
        id: "questions",
        header: "Served",
        accessorFn: (e) => e.questionsToServe,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap tabular text-ink-2">
            {row.original.questionsToServe} of {row.original.questionCount}
          </span>
        ),
      },
      {
        id: "passMark",
        header: "Pass mark",
        accessorFn: (e) => e.passMarkPct,
        cell: ({ row }) => (
          <span className="text-sm tabular text-ink-2">{row.original.passMarkPct}%</span>
        ),
      },
      {
        id: "duration",
        header: "Time",
        accessorFn: (e) => e.durationMin,
        cell: ({ row }) => (
          <span className="flex items-center gap-1 text-sm whitespace-nowrap text-ink-2">
            <ClockIcon className="size-3.5" />
            {row.original.durationMin} min
          </span>
        ),
      },
      {
        id: "recipients",
        header: "Recipients",
        accessorFn: (e) => e.recipientsCount,
        cell: ({ row }) => (
          <span className="text-sm tabular text-ink-2">
            {formatNumber(row.original.recipientsCount)}
          </span>
        ),
      },
      {
        id: "sentAt",
        header: "Sent",
        accessorFn: (e) => e.sentAt ?? "",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {row.original.sentAt ? formatDate(row.original.sentAt) : "Not sent"}
          </span>
        ),
      },
      {
        id: "closesAt",
        header: "Closes",
        accessorFn: (e) => e.closesAt ?? "",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {row.original.closesAt ? formatDate(row.original.closesAt) : "—"}
          </span>
        ),
      },
    ],
    [courseName],
  );

  const attemptColumns = React.useMemo<ColumnDef<ExamAttempt, unknown>[]>(
    () => [
      {
        id: "trainee",
        header: "Trainee",
        accessorFn: (a) => traineeName(a.traineeId),
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <AvatarInitials name={traineeName(row.original.traineeId)} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">
                {traineeName(row.original.traineeId)}
              </p>
              <p className="truncate font-mono text-xs text-ink-3">
                {traineeNo(row.original.traineeId)}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "course",
        header: "Course",
        accessorFn: (a) => courseName(a.courseId),
        cell: ({ row }) => (
          <span className="text-sm text-ink-2">{courseName(row.original.courseId)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (a) => a.status,
        cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
      },
      {
        id: "score",
        header: "Score",
        accessorFn: (a) => a.score ?? -1,
        cell: ({ row }) => (
          <span className="text-sm font-medium tabular text-ink">
            {row.original.score === null ? "—" : formatPercent(row.original.score)}
          </span>
        ),
      },
      {
        id: "integrity",
        header: "Integrity",
        accessorFn: (a) => a.integrityFlags.length,
        cell: ({ row }) =>
          row.original.integrityFlags.length === 0 ? (
            <span className="flex items-center gap-1 text-xs text-green">
              <CheckCircle2Icon className="size-3.5" />
              Clean
            </span>
          ) : (
            <Badge variant="amber" size="sm">
              <FlagIcon className="size-3" />
              {row.original.integrityFlags.length} flag
              {row.original.integrityFlags.length === 1 ? "" : "s"}
            </Badge>
          ),
      },
      {
        id: "submitted",
        header: "Submitted",
        accessorFn: (a) => a.submittedAt ?? "",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap text-ink-2">
            {row.original.submittedAt ? formatDateTime(row.original.submittedAt) : "—"}
          </span>
        ),
      },
    ],
    [courseName, traineeName, traineeNo],
  );

  const flaggedCount = attempts.filter((a) => a.integrityFlags.length > 0).length;
  const passedCount = attempts.filter((a) => a.status === "PASSED").length;
  const activeExams = exams.filter((e) => e.status === "ACTIVE").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Exams"
        subtitle="Schedule exams, send links and review submitted attempts."
        actions={
          canSchedule ? (
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/exams/new">
                <PlusIcon className="size-4" />
                Schedule exam
              </Link>
            </Button>
          ) : null
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active exams"
          value={formatNumber(activeExams)}
          icon={<CalendarClockIcon className="size-4" />}
          isLoading={examsQuery.isLoading}
        />
        <StatCard
          label="Attempts in view"
          value={formatNumber(attempts.length)}
          icon={<UsersIcon className="size-4" />}
          isLoading={attemptsQuery.isLoading}
        />
        <StatCard
          label="Passed"
          value={formatNumber(passedCount)}
          hint={
            attempts.length ? `of ${attempts.length} graded` : undefined
          }
          icon={<CheckCircle2Icon className="size-4" />}
          isLoading={attemptsQuery.isLoading}
        />
        <StatCard
          label="Integrity flags"
          value={formatNumber(flaggedCount)}
          hint="needs review"
          invertTrend
          icon={<AlertTriangleIcon className="size-4" />}
          isLoading={attemptsQuery.isLoading}
        />
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search exams or trainees…"
          className="sm:max-w-xs"
        />
        <MultiSelectFilter
          label="Exam status"
          width="w-56"
          options={EXAM_STATUS.map((s) => ({ value: s, label: EXAM_STATUS_LABEL[s]! }))}
          selected={examStatuses}
          onChange={setExamStatuses}
        />
        <MultiSelectFilter
          label="Attempt status"
          width="w-60"
          options={ATTEMPT_STATUSES.map((s) => ({
            value: s,
            label: s.charAt(0) + s.slice(1).toLowerCase(),
          }))}
          selected={attemptStatuses}
          onChange={setAttemptStatuses}
        />
        <Button
          variant={flaggedOnly ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={() => setFlaggedOnly((v) => !v)}
          aria-pressed={flaggedOnly}
        >
          <FlagIcon className="size-3.5" />
          Flagged only
        </Button>
      </div>

      <Tabs defaultValue="exams">
        <TabsList>
          <TabsTrigger value="exams">Exams ({exams.length})</TabsTrigger>
          <TabsTrigger value="attempts">Attempts ({attempts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="exams" className="mt-4">
          <DataTable
            columns={examColumns}
            data={exams}
            getRowId={(e) => e.id}
            isLoading={examsQuery.isLoading}
            onRowClick={(e) => router.push(`/exams/${e.id}`)}
            pageSize={10}
            stickyHeader={false}
            globalFilter={search}
            emptyState={
              <EmptyState
                title="No exams yet"
                description="Schedule an exam to invite trainees and start collecting results."
                action={
                  canSchedule ? (
                    <Button asChild size="sm" className="gap-1.5">
                      <Link href="/exams/new">
                        <SendIcon className="size-4" />
                        Schedule exam
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="attempts" className="mt-4">
          <DataTable
            columns={attemptColumns}
            data={attempts}
            getRowId={(a) => a.id}
            isLoading={attemptsQuery.isLoading}
            onRowClick={(a) => router.push(`/exams/attempts/${a.id}`)}
            pageSize={20}
            stickyHeader={false}
            globalFilter={search}
            emptyState={
              <EmptyState
                title="No attempts match"
                description="Attempts appear once exam links are sent and trainees start the exam."
              />
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
