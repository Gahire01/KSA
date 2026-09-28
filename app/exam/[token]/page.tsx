"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  EyeOffIcon,
  FileTextIcon,
  FlagIcon,
  LoaderIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/shared/Logo";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { mockApi } from "@/lib/mock";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/utils/format";

type Phase = "brief" | "running" | "submitted";

export default function ExamRunnerPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const queryClient = useQueryClient();

  const [phase, setPhase] = React.useState<Phase>("brief");
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [flagged, setFlagged] = React.useState<Set<string>>(new Set());
  const [blurCount, setBlurCount] = React.useState(0);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [result, setResult] = React.useState<{
    score: number | null;
    status: string;
    correctCount: number | null;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["attempt", "token", token],
    queryFn: () => mockApi.attempts.byToken(token),
    enabled: Boolean(token),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: () => mockApi.attempts.submit(token, answers, blurCount),
    onSuccess: (res) => {
      if (!res) {
        toast.error("This attempt could not be submitted.");
        return;
      }
      setResult({
        score: res.attempt.score,
        status: res.attempt.status,
        correctCount: res.attempt.correctCount,
      });
      setPhase("submitted");
      void queryClient.invalidateQueries({ queryKey: ["attempt"] });
    },
    onError: () => toast.error("Submission failed. Your answers are still saved."),
  });

  /* Integrity: count focus losses while the paper is open. */
  React.useEffect(() => {
    if (phase !== "running") return;
    const onBlur = () => setBlurCount((n) => n + 1);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [phase]);

  /* Countdown starts once the trainee accepts the rules. */
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);
  const examDuration = data?.exam?.durationMin ?? 45;

  React.useEffect(() => {
    if (phase !== "running" || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      submitMutation.mutate();
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft]);

  /* Autosave so a refresh or dropped connection does not lose answers. */
  React.useEffect(() => {
    if (phase !== "running") return;
    const id = window.setTimeout(() => {
      void mockApi.attempts.saveProgress(token, answers, blurCount);
    }, 900);
    return () => window.clearTimeout(id);
  }, [answers, blurCount, phase, token]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="This exam link is not valid"
          description="It may have been revoked, replaced, or already used. Ask your trainer to send a new link."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/login">Go to sign in</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { attempt, exam, course, questions } = data;
  const passed = result?.status === "PASSED";

  /* ── Results ─────────────────────────────────────────────── */
  if (phase === "submitted" && result) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-12">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span
              className={
                passed
                  ? "flex size-14 items-center justify-center rounded-full bg-green-bg text-green"
                  : "flex size-14 items-center justify-center rounded-full bg-red-bg text-red"
              }
              aria-hidden
            >
              {passed ? (
                <CheckCircle2Icon className="size-7" />
              ) : (
                <XCircleIcon className="size-7" />
              )}
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">
                {passed ? "Congratulations, you passed" : "Not passed this time"}
              </h1>
              <p className="mt-1 text-sm text-ink-2">
                {exam?.title} · submitted {formatDateTime(attempt.submittedAt ?? new Date().toISOString())}
              </p>
            </div>
            <p className="font-display text-5xl font-semibold text-ink tabular">
              {formatPercent(result.score ?? 0)}
            </p>
            <p className="text-sm text-ink-2">
              {result.correctCount} of {questions.length} correct · pass mark{" "}
              {exam?.passMarkPct ?? 70}%
            </p>
            {passed ? (
              <p className="rounded-lg bg-green-bg px-4 py-3 text-sm text-green">
                Your certificate has been issued and now appears on your record.
              </p>
            ) : (
              <p className="rounded-lg bg-amber-bg px-4 py-3 text-sm text-amber">
                Ask your trainer whether another attempt is available. Answers are saved
                to your record either way.
              </p>
            )}
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Briefing ────────────────────────────────────────────── */
  if (phase === "brief") {
    return (
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
        <Logo />
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">{exam?.title}</h1>
              <p className="mt-1 text-sm text-ink-2">{course?.name}</p>
            </div>

            <dl className="grid gap-3 sm:grid-cols-3">
              <Rule
                icon={<FileTextIcon className="size-4" />}
                label="Questions"
                value={formatNumber(questions.length)}
              />
              <Rule
                icon={<ClockIcon className="size-4" />}
                label="Time limit"
                value={`${examDuration} minutes`}
              />
              <Rule
                icon={<FlagIcon className="size-4" />}
                label="Pass mark"
                value={`${exam?.passMarkPct ?? 70}%`}
              />
            </dl>

            {exam?.closesAt ? (
              <p className="rounded-lg bg-paper px-3 py-2 text-sm text-ink-2">
                This link closes {formatDateTime(exam.closesAt)}.
              </p>
            ) : null}

            <div className="space-y-2 rounded-lg border border-amber/40 bg-amber-bg p-4 text-sm text-amber">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangleIcon className="size-4" />
                Before you begin
              </p>
              <ul className="ml-6 list-disc space-y-1 text-ink-2">
                <li>The timer starts when you select “Begin exam” and keeps running if you leave.</li>
                <li>Leaving this tab is recorded as an integrity flag for staff review.</li>
                <li>
                  {exam?.maxAttempts
                    ? `You have up to ${exam.maxAttempts} attempts in total.`
                    : "Attempt limits apply."}
                </li>
                <li>Answers save automatically, but submit before the timer ends.</li>
              </ul>
            </div>

            <Button
              className="w-full gap-1.5"
              onClick={() => {
                setSecondsLeft(examDuration * 60);
                setPhase("running");
                void mockApi.attempts.saveProgress(token, answers, blurCount);
              }}
            >
              Begin exam
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Question paper ──────────────────────────────────────── */
  const question = questions[index];
  const answered = questions.filter((q) => answers[q.id]).length;
  const progressPct = questions.length ? (answered / questions.length) * 100 : 0;
  const mm = secondsLeft === null ? "--" : String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = secondsLeft === null ? "--" : String(secondsLeft % 60).padStart(2, "0");
  const lowTime = secondsLeft !== null && secondsLeft <= 300;

  if (!question) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState title="No questions available" description="Contact your trainer." />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper">
      {/* Sticky exam bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{exam?.title}</p>
            <p className="truncate text-xs text-ink-2">
              Question {index + 1} of {questions.length} · {answered} answered
              {blurCount > 0 ? ` · ${blurCount} focus loss${blurCount === 1 ? "" : "es"}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={
                lowTime
                  ? "flex items-center gap-1.5 rounded-lg bg-red-bg px-3 py-1.5 font-mono text-sm font-semibold text-red"
                  : "flex items-center gap-1.5 rounded-lg bg-paper px-3 py-1.5 font-mono text-sm font-semibold text-ink"
              }
              aria-live="off"
            >
              <ClockIcon className="size-4" />
              {mm}:{ss}
            </span>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setSubmitOpen(true)}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <SendIcon className="size-4" />
              )}
              Submit
            </Button>
          </div>
        </div>
        <Progress value={progressPct} className="h-1 rounded-none" />
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-ink">
                <span className="mr-2 text-sm font-normal text-ink-3">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {question.text}
              </h2>
              <button
                type="button"
                onClick={() =>
                  setFlagged((prev) => {
                    const next = new Set(prev);
                    if (next.has(question.id)) next.delete(question.id);
                    else next.add(question.id);
                    return next;
                  })
                }
                aria-pressed={flagged.has(question.id)}
                className={
                  flagged.has(question.id)
                    ? "flex shrink-0 items-center gap-1 rounded-lg bg-amber-bg px-2 py-1 text-xs font-medium text-amber"
                    : "flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-ink-2 hover:bg-paper"
                }
              >
                <FlagIcon className="size-3.5" />
                {flagged.has(question.id) ? "Flagged" : "Flag"}
              </button>
            </div>

            <RadioGroup
              value={answers[question.id] ?? ""}
              onValueChange={(v) => setAnswers((prev) => ({ ...prev, [question.id]: v }))}
              className="gap-2"
            >
              {question.options.map((opt) => (
                <label
                  key={opt.id}
                  htmlFor={`opt-${opt.id}`}
                  className={
                    answers[question.id] === opt.id
                      ? "flex cursor-pointer items-start gap-3 rounded-xl border-2 border-orange bg-orange/5 px-4 py-3"
                      : "flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:border-ink-3"
                  }
                >
                  <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} className="mt-0.5" />
                  <span className="text-sm leading-relaxed text-ink">{opt.text}</span>
                </label>
              ))}
            </RadioGroup>

            <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubmitOpen(true)}
                >
                  Finish later
                </Button>
                {index === questions.length - 1 ? (
                  <Button size="sm" onClick={() => setSubmitOpen(true)}>
                    Review &amp; submit
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
                    Next
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigator */}
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-ink-2 uppercase">
              Question navigator
            </p>
            <div className="flex flex-wrap gap-1.5">
              {questions.map((q, i) => {
                const isCurrent = i === index;
                const isAnswered = Boolean(answers[q.id]);
                const isFlagged = flagged.has(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={
                      isCurrent
                        ? "flex size-8 items-center justify-center rounded-lg bg-navy text-xs font-semibold text-white"
                        : isAnswered
                          ? "flex size-8 items-center justify-center rounded-lg bg-green-bg text-xs font-semibold text-green"
                          : isFlagged
                            ? "flex size-8 items-center justify-center rounded-lg bg-amber-bg text-xs font-semibold text-amber"
                            : "flex size-8 items-center justify-center rounded-lg border border-line text-xs text-ink-2 hover:bg-paper"
                    }
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
              <Legend className="bg-green-bg ring-green/30" label="Answered" />
              <Legend className="bg-amber-bg ring-amber/30" label="Flagged" />
              <Legend className="bg-card ring-line" label="Not answered" />
            </div>
            {blurCount > 0 ? (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-bg px-3 py-2 text-xs text-amber">
                <EyeOffIcon className="mt-0.5 size-3.5 shrink-0" />
                Leaving the exam window {blurCount === 1 ? "has been" : "has"} recorded{" "}
                {blurCount === 1 ? "once" : `${blurCount} times`} and will be shown to
                staff.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {submitMutation.isPending ? (
          <p className="flex items-center justify-center gap-2 text-sm text-ink-2">
            <LoaderIcon className="size-4 animate-spin" />
            Submitting and grading…
          </p>
        ) : null}
      </main>

      <ConfirmDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit your exam?"
        description={
          questions.length - answered > 0
            ? `${questions.length - answered} question${questions.length - answered === 1 ? "" : "s"} left unanswered. Unanswered questions score zero.`
            : "All questions are answered. Your exam is graded immediately."
        }
        confirmLabel="Submit exam"
        onConfirm={() => submitMutation.mutate()}
      />
    </div>
  );
}

function Rule({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-ink-2 uppercase">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-base font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ring-1 ${className}`} aria-hidden />
      {label}
    </span>
  );
}
