"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  BanIcon,
  CheckCircle2Icon,
  ClockIcon,
  EyeOffIcon,
  GlobeIcon,
  MonitorIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockApi } from "@/lib/mock";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@/lib/utils/format";

const FLAG_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  TAB_BLUR: {
    label: "Tab lost focus",
    icon: EyeOffIcon,
    tone: "text-amber bg-amber-bg",
  },
  PASTE_ATTEMPT: {
    label: "Paste detected",
    icon: AlertTriangleIcon,
    tone: "text-amber bg-amber-bg",
  },
  COPY_ATTEMPT: {
    label: "Copy detected",
    icon: AlertTriangleIcon,
    tone: "text-amber bg-amber-bg",
  },
  FULLSCREEN_EXIT: {
    label: "Exited fullscreen",
    icon: MonitorIcon,
    tone: "text-amber bg-amber-bg",
  },
  LATE_SUBMIT: {
    label: "Submitted after deadline",
    icon: ClockIcon,
    tone: "text-red bg-red-bg",
  },
};

export default function AttemptReviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const canVoid = role === "OWNER" || role === "ADMIN";

  const [voidOpen, setVoidOpen] = React.useState(false);
  const [voidReason, setVoidReason] = React.useState("");

  const attemptQuery = useQuery({
    queryKey: ["attempt", "by-id", id],
    queryFn: async () => {
      const attempt = await mockApi.attempts.get(id);
      if (!attempt) return null;
      return mockApi.attempts.byToken(attempt.token);
    },
    enabled: Boolean(id),
  });

  const voidMutation = useMutation({
    mutationFn: () => mockApi.attempts.void(id, voidReason.trim() || "Voided by staff"),
    onSuccess: () => {
      toast.success("Attempt voided", {
        description: "It no longer counts towards the pass rate.",
      });
      void queryClient.invalidateQueries({ queryKey: ["attempts"] });
      void queryClient.invalidateQueries({ queryKey: ["attempt"] });
    },
    onError: () => toast.error("Could not void this attempt."),
  });

  if (attemptQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const result = attemptQuery.data;
  if (!result) {
    return (
      <EmptyState
        title="Attempt not found"
        description="This attempt may have been removed from the dataset."
        action={
          <Button asChild size="sm">
            <Link href="/exams">Back to exams</Link>
          </Button>
        }
      />
    );
  }

  const { attempt, exam, course, trainee, questions } = result;
  const score = attempt.score ?? 0;
  const passMark = exam?.passMarkPct ?? course?.passMarkPct ?? 70;
  const passed = attempt.status === "PASSED";
  const answersByQuestion = new Map(attempt.perQuestion.map((p) => [p.questionId, p]));

  return (
    <div className="space-y-5">

      <PageHeader
        breadcrumbSlot={
          <Link href="/exams" className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Exams
          </Link>
        }
        title={`Attempt review — ${trainee?.name ?? attempt.traineeId}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{course?.name ?? "—"}</span>
            <span aria-hidden>·</span>
            <span>Attempt {attempt.attemptNumber}</span>
            <span aria-hidden>·</span>
            <span>{formatDateTime(attempt.submittedAt ?? attempt.startedAt)}</span>
          </span>
        }
        actions={
          canVoid && attempt.status !== "VOID" && attempt.status !== "PASSED" ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-red"
              onClick={() => setVoidOpen(true)}
            >
              <BanIcon className="size-4" />
              Void attempt
            </Button>
          ) : null
        }
      />

      {/* ── Verdict ────────────────────────────────────────────── */}
      <Card>
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-paper p-5 text-center">
            <span
              className={
                passed
                  ? "flex size-12 items-center justify-center rounded-full bg-green-bg text-green"
                  : "flex size-12 items-center justify-center rounded-full bg-red-bg text-red"
              }
              aria-hidden
            >
              {passed ? (
                <CheckCircle2Icon className="size-6" />
              ) : (
                <XCircleIcon className="size-6" />
              )}
            </span>
            <p className="font-display text-4xl font-semibold text-ink tabular">
              {formatPercent(score)}
            </p>
            <p className="text-sm text-ink-2">
              {attempt.correctCount} of {attempt.questionCount} correct · pass mark{" "}
              {passMark}%
            </p>
            <StatusBadge
              status={attempt.status}
              className="mt-1"
              label={passed ? "Passed" : attempt.status === "VOID" ? "Voided" : "Failed"}
            />
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail
                label="Trainee"
                value={
                  trainee ? (
                    <Link
                      href={`/trainees/${trainee.id}`}
                      className="flex items-center gap-2 underline decoration-line underline-offset-2 hover:decoration-orange"
                    >
                      <AvatarInitials name={trainee.name} size="xs" />
                      {trainee.name}
                    </Link>
                  ) : (
                    attempt.traineeId
                  )
                }
              />
              <Detail
                label="Time used"
                value={formatDuration(attempt.durationUsedSec)}
              />
              <Detail
                label="Started"
                value={formatDateTime(attempt.startedAt)}
              />
              <Detail
                label="Submitted"
                value={formatDateTime(attempt.submittedAt)}
              />
              <Detail
                label="IP address"
                value={
                  <span className="flex items-center gap-1.5 font-mono text-xs">
                    <GlobeIcon className="size-3 text-ink-3" />
                    {attempt.ip}
                  </span>
                }
              />
              <Detail
                label="Attempt ID"
                value={<span className="font-mono text-xs">{attempt.id}</span>}
              />
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-2 uppercase">
                Integrity
              </p>
              {attempt.integrityFlags.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-green">
                  <CheckCircle2Icon className="size-4" />
                  No anomalies recorded for this attempt.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {attempt.integrityFlags.map((flag) => {
                    const meta = FLAG_META[flag.type] ?? {
                      label: flag.type,
                      icon: AlertTriangleIcon,
                      tone: "text-amber bg-amber-bg",
                    };
                    const Icon = meta.icon;
                    return (
                      <li key={flag.id}>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${meta.tone}`}
                          title={flag.detail}
                        >
                          <Icon className="size-3.5" />
                          {meta.label}
                          <span className="opacity-70">
                            {formatDateTime(flag.at)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {attempt.voidedReason ? (
              <p className="rounded-lg bg-red-bg px-3 py-2 text-sm text-red">
                Voided: {attempt.voidedReason}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ── Answer sheet ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Answer sheet</CardTitle>
          <CardDescription>
            Correct answers and explanations are revealed for staff review.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ol className="divide-y divide-line">
            {questions.map((q, i) => {
              const record = answersByQuestion.get(q.id);
              const correctOption = q.options.find((o) => o.isCorrect);
              const selectedId = record?.selectedOptionId ?? attempt.answers[q.id] ?? "";
              const isRight = record
                ? record.isCorrect
                : selectedId === correctOption?.id;

              return (
                <li key={q.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-ink">
                      <span className="mr-2 font-mono text-xs text-ink-3">
                        Q{i + 1}
                      </span>
                      {q.text}
                    </p>
                    <span
                      aria-hidden
                      className={
                        isRight
                          ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-green-bg text-green"
                          : "flex size-6 shrink-0 items-center justify-center rounded-full bg-red-bg text-red"
                      }
                    >
                      {isRight ? (
                        <CheckCircle2Icon className="size-4" />
                      ) : (
                        <XCircleIcon className="size-4" />
                      )}
                    </span>
                  </div>

                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((o) => {
                      const isSelected = o.id === selectedId;
                      const isCorrect = o.isCorrect;
                      return (
                        <li
                          key={o.id}
                          className={
                            isCorrect
                              ? "rounded-lg border border-green/40 bg-green-bg px-3 py-2 text-sm text-green"
                              : isSelected
                                ? "rounded-lg border border-red/40 bg-red-bg px-3 py-2 text-sm text-red"
                                : "rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink-2"
                          }
                        >
                          {o.text}
                          {isSelected ? (
                            <Badge variant="outline" className="ml-2 bg-card/60">
                              selected
                            </Badge>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  {q.explanation ? (
                    <p className="mt-2 rounded-lg border-l-2 border-orange bg-muted px-3 py-2 text-xs text-ink-2">
                      {q.explanation}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* ── Summary table ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Question summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Q</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-32 text-right">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q, i) => {
                const record = answersByQuestion.get(q.id);
                const isRight =
                  record?.isCorrect ??
                  (attempt.answers[q.id] ?? "") ===
                    (q.options.find((o) => o.isCorrect)?.id ?? "");
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs text-ink-3">{i + 1}</TableCell>
                    <TableCell className="max-w-xl truncate text-sm">
                      {q.text}
                    </TableCell>
                    <TableCell className="text-right">
                      {isRight ? (
                        <span className="text-sm font-medium text-green">Correct</span>
                      ) : (
                        <span className="text-sm font-medium text-red">
                          {record?.selectedOptionId || attempt.answers[q.id]
                            ? "Incorrect"
                            : "Unanswered"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-3">
          {formatNumber(questions.length)} questions served · token{" "}
          <span className="font-mono">{attempt.token}</span>
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => router.push("/exams")}
        >
          Back to exams
        </Button>
      </div>

      <ConfirmDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="Void this attempt?"
        description="The attempt is kept for the audit trail but excluded from pass rates and certificate issuance."
        confirmLabel="Void attempt"
        destructive
        onConfirm={() => {
          voidMutation.mutate();
          setVoidReason("");
        }}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wider text-ink-2 uppercase">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-ink">{value}</div>
    </div>
  );
}
