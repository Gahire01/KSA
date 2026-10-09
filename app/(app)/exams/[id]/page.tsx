"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, ClockIcon, ListChecksIcon, SendIcon, ShuffleIcon, TargetIcon, UploadIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

/**
 * /exams/[id] — one course's exam: its rules, its question bank and its recent
 * sittings. [id] is the course id, and the page always renders: a course with no
 * questions shows an empty state that points at the import page, and an id that
 * matches nothing shows "Course not found" instead of an error.
 *
 * Staff see which option is correct (that is how they set the paper). Nothing here
 * is reachable from the trainee's exam link.
 */

interface CourseDetail {
  id: string;
  code: string;
  name: string;
  passMarkPct: number;
  maxAttempts: number;
  examDurationMin: number;
  isActive: boolean;
}

interface BankQuestion {
  id: string;
  text: string;
  position: number;
  isActive: boolean;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
}

interface SittingRow {
  id: string;
  status: string;
  attemptNumber: number;
  scorePct: number | null;
  blurCount: number;
  submittedAt: string | null;
  createdAt: string;
  trainee: { fullName: string; traineeNo: string };
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Sent, not opened",
  STARTED: "In progress",
  SUBMITTED: "Not passed",
  PASSED: "Passed",
  FAILED: "Failed",
  VOID: "Void",
};

export default function ExamDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const canWrite = role === "OWNER" || role === "ADMIN" || role === "TRAINER";

  const courseQuery = useQuery({
    queryKey: ["exam-course", id],
    queryFn: () => api.get<CourseDetail>(`/courses/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
    retry: false,
  });
  const course = courseQuery.data;

  const questionsQuery = useQuery({
    queryKey: ["exam-questions", id],
    queryFn: () => api.get<{ items: BankQuestion[]; total: number }>("/questions", { courseId: id }),
    enabled: Boolean(course),
  });
  const questions = React.useMemo(() => questionsQuery.data?.items ?? [], [questionsQuery.data]);

  const sittingsQuery = useQuery({
    queryKey: ["exam-sittings", id],
    queryFn: () => api.get<{ items: SittingRow[] }>("/exams", { courseId: id, pageSize: 10 }),
    enabled: Boolean(course),
  });
  const sittings = sittingsQuery.data?.items ?? [];

  if (courseQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!course) {
    const message =
      courseQuery.error instanceof ApiError && courseQuery.error.status !== 404
        ? courseQuery.error.message
        : "This course may have been removed, or the link is wrong.";
    return (
      <EmptyState
        title="Course not found"
        description={message}
        action={
          <Button asChild size="sm">
            <Link href="/exams">Back to exams</Link>
          </Button>
        }
      />
    );
  }

  const active = questions.filter((q) => q.isActive);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbSlot={
          <Link href="/exams" className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Exams
          </Link>
        }
        title={course.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono">{course.code}</span>
            <span aria-hidden>·</span>
            <span>{formatNumber(active.length)} questions in the bank</span>
          </span>
        }
        actions={
          canWrite ? (
            <>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href={`/exams/${course.id}/import`}>
                  <UploadIcon className="size-4" />
                  Import questions
                </Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/exams/new?courseId=${course.id}`}>
                  <SendIcon className="size-4" />
                  Send exam
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact icon={<ListChecksIcon className="size-4" />} label="Questions" value={formatNumber(active.length)} />
        <Fact icon={<ClockIcon className="size-4" />} label="Time limit" value={`${course.examDurationMin} min`} />
        <Fact icon={<TargetIcon className="size-4" />} label="Pass mark" value={`${course.passMarkPct}%`} />
        <Fact icon={<CheckCircle2Icon className="size-4" />} label="Attempts" value={String(course.maxAttempts)} />
      </div>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">How this exam runs</CardTitle>
          <CardDescription>
            Every trainee gets every active question, in an order and with options shuffled just for their sitting.
            Leaving the exam window once shows a warning; leaving it a second time ends the exam as failed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="green">
              <ShuffleIcon className="size-3" />
              Questions shuffled
            </Badge>
            <Badge variant="green">
              <ShuffleIcon className="size-3" />
              Options shuffled
            </Badge>
            <Badge variant="outline">Single tab</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Question bank</CardTitle>
          <CardDescription>The correct option is marked for staff only. Trainees never receive it.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {questionsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <EmptyState
              compact
              title="No questions yet."
              description={`Upload via /exams/${course.id}/import.`}
              action={
                canWrite ? (
                  <Button asChild size="sm" className="gap-1.5">
                    <Link href={`/exams/${course.id}/import`}>
                      <UploadIcon className="size-4" />
                      Import questions
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ol className="divide-y divide-line">
              {questions.map((q, i) => (
                <li key={q.id} className="px-4 py-3.5">
                  <p className="flex gap-2 text-sm font-medium text-ink">
                    <span className="shrink-0 tabular text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                    <span>{q.text}</span>
                    {!q.isActive ? <Badge variant="neutral">Off</Badge> : null}
                  </p>
                  <ul className="mt-2 grid gap-1 pl-7 sm:grid-cols-2">
                    {q.options.map((o, k) => (
                      <li
                        key={o.id}
                        className={
                          o.isCorrect
                            ? "flex items-start gap-1.5 rounded-md bg-green-bg px-2 py-1 text-sm text-green"
                            : "flex items-start gap-1.5 px-2 py-1 text-sm text-ink-2"
                        }
                      >
                        <span className="shrink-0 font-semibold">{"ABCD"[k] ?? k + 1}.</span>
                        <span>{o.text}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Recent sittings</CardTitle>
          <CardDescription>The last ten attempts on this exam.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sittings.length === 0 ? (
            <EmptyState compact title="No sittings yet" description="Send the exam to a trainee to get started." />
          ) : (
            <ul className="divide-y divide-line">
              {sittings.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/exams/${course.id}/attempts/${s.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
                  >
                    <AvatarInitials name={s.trainee.fullName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{s.trainee.fullName}</span>
                      <span className="block text-xs text-ink-3">
                        Attempt #{s.attemptNumber} · {formatDateTime(s.submittedAt ?? s.createdAt)}
                      </span>
                    </span>
                    {s.blurCount > 0 ? (
                      <span className="text-xs font-medium text-amber">Window left {s.blurCount}×</span>
                    ) : null}
                    <span className="w-12 text-right text-sm tabular text-ink">
                      {s.scorePct === null ? "—" : `${s.scorePct}%`}
                    </span>
                    <StatusBadge status={s.status} label={STATUS_LABEL[s.status]} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 shadow-sm">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-ink-2 uppercase">
        <span aria-hidden>{icon}</span>
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold text-ink tabular">{value}</p>
    </div>
  );
}
