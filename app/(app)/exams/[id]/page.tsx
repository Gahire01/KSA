"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClockIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  ListChecksIcon,
  SendIcon,
  ShuffleIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockApi } from "@/lib/mock";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils/format";

const EXAM_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  DRAFT: "Draft",
};

export default function ExamDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const canManage = role === "OWNER" || role === "ADMIN";

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const examQuery = useQuery({
    queryKey: ["exam", id],
    queryFn: () => mockApi.exams.get(id),
    enabled: Boolean(id),
  });
  const recipientsQuery = useQuery({
    queryKey: ["exam-recipients", id],
    queryFn: () => mockApi.exams.recipients(id),
    enabled: Boolean(id),
  });
  const coursesQuery = useQuery({
    queryKey: ["courses", "options"],
    queryFn: () => mockApi.courses.list(),
    staleTime: 5 * 60_000,
  });

  const exam = examQuery.data;
  const recipients = recipientsQuery.data ?? [];
  const course = coursesQuery.data?.find((c) => c.id === exam?.courseId);

  const sendMutation = useMutation({
    mutationFn: (ids: string[]) => mockApi.exams.sendLinks(id, ids),
    onSuccess: (count) => {
      toast.success(`Links sent to ${count} trainee${count === 1 ? "" : "s"}`, {
        description: "Each link is single-use and expires with the exam.",
      });
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["exam-recipients", id] });
      void queryClient.invalidateQueries({ queryKey: ["exam", id] });
      void queryClient.invalidateQueries({ queryKey: ["attempts"] });
    },
    onError: () => toast.error("Could not send the exam links."),
  });

  if (examQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!exam) {
    return (
      <EmptyState
        title="Exam not found"
        description="This exam may have been removed."
        action={
          <Button asChild size="sm">
            <Link href="/exams">Back to exams</Link>
          </Button>
        }
      />
    );
  }

  const notSent = recipients.filter((r) => r.attempt === null);
  const selectable = notSent.map((r) => r.trainee.id);
  const allSelected = selectable.length > 0 && selectable.every((tid) => selected.has(tid));

  return (
    <div className="space-y-5">
      <DemoBanner>
        This exam, its questions and its attempts are demo data. Sending or
        grading here is not stored.
      </DemoBanner>

      <PageHeader
        breadcrumbSlot={
          <Link href="/exams" className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Exams
          </Link>
        }
        title={exam.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{course?.name ?? "—"}</span>
            <span aria-hidden>·</span>
            <span>{formatNumber(exam.recipientsCount)} recipients</span>
            <span aria-hidden>·</span>
            <span>
              {exam.closesAt ? `closes ${formatDate(exam.closesAt)}` : "no close date"}
            </span>
          </span>
        }
        actions={
          canManage ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (selectable.length === 0) return;
                  sendMutation.mutate(selectable);
                }}
                disabled={selectable.length === 0 || sendMutation.isPending}
              >
                <SendIcon className="size-4" />
                Email all ({notSent.length})
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link href="/exams">
                  <EyeIcon className="size-4" />
                  Review attempts
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          icon={<StatusBadge status={exam.status.toLowerCase()} label={EXAM_STATUS_LABEL[exam.status]} />}
          label="Status"
        />
        <Fact
          icon={<ListChecksIcon className="size-4" />}
          label="Questions served"
          value={`${exam.questionsToServe} of ${exam.questionCount}`}
        />
        <Fact
          icon={<ClockIcon className="size-4" />}
          label="Time limit"
          value={`${exam.durationMin} min`}
        />
        <Fact
          icon={<CalendarClockIcon className="size-4" />}
          label="Pass mark"
          value={`${exam.passMarkPct}%`}
        />
      </div>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Exam settings</CardTitle>
          <CardDescription>
            Questions and options are shuffled per attempt using a seeded shuffle, so
            two trainees never see the same order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant={exam.shuffleQuestions ? "green" : "neutral"}>
              <ShuffleIcon className="size-3" />
              Questions {exam.shuffleQuestions ? "shuffled" : "in order"}
            </Badge>
            <Badge variant={exam.shuffleOptions ? "green" : "neutral"}>
              <ShuffleIcon className="size-3" />
              Options {exam.shuffleOptions ? "shuffled" : "in order"}
            </Badge>
            <Badge variant="outline">Max {exam.maxAttempts} attempts</Badge>
            <Badge variant="outline">
              Sent {exam.sentAt ? formatDateTime(exam.sentAt) : "not yet"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base flex items-center gap-2">
            <UsersIcon className="size-4 text-ink-2" />
            Recipients
          </CardTitle>
          <CardDescription>
            Everyone enrolled in {course?.name ?? "this course"}. Tick trainees and send
            individual links.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recipientsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recipients.length === 0 ? (
            <EmptyState
              compact
              title="Nobody enrolled yet"
              description="Enrol trainees in this course to build the recipient list."
            />
          ) : (
            <>
              {canManage && notSent.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) =>
                        setSelected(v ? new Set(selectable) : new Set())
                      }
                      aria-label="Select all trainees without a link"
                    />
                    <span className="text-ink-2">
                      {selected.size} of {selectable.length} selected
                    </span>
                  </label>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={selected.size === 0 || sendMutation.isPending}
                    onClick={() => sendMutation.mutate([...selected])}
                  >
                    <SendIcon className="size-3.5" />
                    Send {selected.size > 0 ? selected.size : ""} link
                    {selected.size === 1 ? "" : "s"}
                  </Button>
                </div>
              ) : null}

              <div className="max-h-[32rem] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {canManage ? <TableHead className="w-10" /> : null}
                      <TableHead>Trainee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((r) => {
                      const link = origin ? `${origin}/exam/${r.token}` : "";
                      return (
                        <TableRow key={r.trainee.id}>
                          {canManage ? (
                            <TableCell>
                              {r.attempt === null ? (
                                <Checkbox
                                  checked={selected.has(r.trainee.id)}
                                  onCheckedChange={(v) =>
                                    setSelected((prev) => {
                                      const next = new Set(prev);
                                      if (v) next.add(r.trainee.id);
                                      else next.delete(r.trainee.id);
                                      return next;
                                    })
                                  }
                                  aria-label={`Select ${r.trainee.name}`}
                                />
                              ) : null}
                            </TableCell>
                          ) : null}
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => router.push(`/trainees/${r.trainee.id}`)}
                              className="flex items-center gap-2.5 text-left"
                            >
                              <AvatarInitials name={r.trainee.name} size="sm" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-ink">
                                  {r.trainee.name}
                                </span>
                                <span className="block font-mono text-xs text-ink-3">
                                  {r.trainee.traineeNo}
                                </span>
                              </span>
                            </button>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={r.status}
                              size="sm"
                              label={
                                r.status === "NOT_SENT" ? "Not sent" : undefined
                              }
                            />
                          </TableCell>
                          <TableCell className="tabular">
                            {r.attempt?.score === null || !r.attempt
                              ? "—"
                              : `${r.attempt.score}%`}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-ink-2">
                            {r.attempt?.submittedAt
                              ? formatDateTime(r.attempt.submittedAt)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.attempt ? (
                              <div className="flex justify-end gap-1">
                                {link ? (
                                  <CopyButton
                                    value={link}
                                    label="exam link"
                                    size={15}
                                    toastMessage="Exam link copied"
                                  />
                                ) : null}
                                <Button asChild variant="ghost" size="icon-sm">
                                  <Link href={`/exams/attempts/${r.attempt.id}`}>
                                    <CheckIcon className="size-4" />
                                    <span className="sr-only">Review attempt</span>
                                  </Link>
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-ink-3">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 shadow-sm">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-ink-2 uppercase">
        <span aria-hidden>{icon}</span>
        {label}
      </p>
      {value ? (
        <p className="mt-1 font-display text-lg font-semibold text-ink tabular">{value}</p>
      ) : (
        <div className="mt-1.5">{icon}</div>
      )}
    </div>
  );
}
