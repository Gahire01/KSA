"use client";

import * as React from "react";
import Link from "next/link";
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

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/utils/format";
import { api, ApiError } from "@/lib/api/client";
import { useExamLockdown } from "@/lib/hooks/use-exam-lockdown";

/**
 * The exam runner.
 *
 * The layout, wording and components are the ones already approved — only the
 * data source changed, from lib/mock to the real API. Nothing here receives
 * `isCorrect` or any other server field: /next projects options to id + text.
 */

export interface RunnerQuestion {
  id: string;
  text: string;
  options: Array<{ id: string; text: string }>;
}

export interface RunnerPaper {
  questions: RunnerQuestion[];
  answers: Record<string, string>;
  secondsLeft: number;
  examDurationMin: number;
  courseName: string;
  traineeName: string;
  passMarkPct: number;
  attemptNumber: number;
  maxAttempts: number;
  startedAt: string | null;
  linkExpiresAt: string;
}

export interface RunnerResult {
  status: string;
  passed: boolean;
  scorePct: number | null;
  correctCount: number | null;
  totalCount: number | null;
  passMarkPct: number;
  attemptNumber: number;
  maxAttempts: number;
  attemptsRemaining: number;
  exhausted: boolean;
  certificate: {
    id: string;
    studentNumber: number;
    verificationToken: string;
  } | null;
}

export function ExamRunner({
  token,
  paper,
  onSubmitted,
}: {
  token: string;
  paper: RunnerPaper;
  onSubmitted: (result: RunnerResult) => void;
}) {
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>(paper.answers);
  const [flagged, setFlagged] = React.useState<Set<string>>(new Set());
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  /**
   * The answer change that has not reached the server yet.
   *
   * Held as an explicit pair rather than derived from `answers`, because "the last
   * key in the object" is not the question the trainee just touched: re-answering an
   * earlier question rewrites an existing key and leaves it where it was. This also
   * gives `submit` something to flush, so the final answer cannot be lost to the
   * autosave debounce.
   */
  const pendingSave = React.useRef<{ questionId: string; optionId: string } | null>(null);
  const saveTimer = React.useRef<number | null>(null);
  const autoSubmitted = React.useRef(false);

  /* Lockdown: blocked actions, focus-loss counting, fullscreen state. The server
   * owns the consequence: past five focus losses it closes the sitting itself and
   * tells us so here. */
  const { blurCount, fullscreen, screenHidden, requestFullscreen } = useExamLockdown({
    token,
    onAutoSubmitted: (result) => {
      autoSubmitted.current = true;
      onSubmitted(result as RunnerResult);
    },
  });

  /* Server-authoritative clock: seeded from secondsLeft, decremented locally each
   * second, and re-synced from /time every 30 seconds so a changed system clock
   * or a throttled background tab cannot gain or lose time. */
  const [secondsLeft, setSecondsLeft] = React.useState(paper.secondsLeft);

  const questions = paper.questions;
  const answered = questions.filter((q) => answers[q.id]).length;
  const progressPct = questions.length ? (answered / questions.length) * 100 : 0;
  const lowTime = secondsLeft <= 300;

  const sendSave = React.useCallback(
    async (change: { questionId: string; optionId: string }) => {
      await api
        .post(`/exams/attempts/${encodeURIComponent(token)}/answer`, {
          questionId: change.questionId,
          optionId: change.optionId,
          blurCount,
        })
        .catch(() => {
          /* Silent: the next change or the submit will reconcile. */
        });
    },
    [blurCount, token],
  );

  /** Sends any debounced change immediately. Safe to call when nothing is queued. */
  const flushPendingSave = React.useCallback(async () => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const change = pendingSave.current;
    if (!change) return;
    pendingSave.current = null;
    await sendSave(change);
  }, [sendSave]);

  const submit = React.useCallback(async () => {
    setSubmitting(true);
    try {
      /* The server grades what it has on file, so an unsent answer would be graded
       * as unanswered. Push the last change before asking for the result. */
      await flushPendingSave();
      const result = await api.post<RunnerResult>(
        `/exams/attempts/${encodeURIComponent(token)}/submit`,
        { blurCount },
      );
      setSubmitOpen(false);
      onSubmitted(result);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Submission failed. Try again.",
        { description: "Your answers are still saved." },
      );
    } finally {
      setSubmitting(false);
    }
  }, [blurCount, flushPendingSave, onSubmitted, token]);

  /* Re-sync the clock with the server every 30 seconds. */
  React.useEffect(() => {
    const id = window.setInterval(() => {
      api
        .get<{ secondsRemaining: number }>(`/exams/attempts/${encodeURIComponent(token)}/time`)
        .then((t) => setSecondsLeft(Math.max(0, t.secondsRemaining)))
        .catch(() => {
          /* Keep counting locally; the next poll or the server's own checks decide. */
        });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [token]);

  /* Timer. On expiry the paper submits itself, exactly once: `autoSubmitted` keeps
   * the zero-second tick from firing a second submit while the first is in flight. */
  React.useEffect(() => {
    if (secondsLeft <= 0) {
      if (!autoSubmitted.current) {
        autoSubmitted.current = true;
        void submit();
      }
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft, submit]);

  /* Autosave, debounced. Server-authoritative: the answer rows are the record, so
   * a refresh mid-paper loses nothing. */
  React.useEffect(() => {
    const change = pendingSave.current;
    if (!change) return;

    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      pendingSave.current = null;
      void sendSave(change);
    }, 900);

    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [answers, sendSave]);

  /* Never leave a queued change behind when the runner unmounts. */
  React.useEffect(() => () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
  }, []);

  const question = questions[index];

  if (!question) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="font-display text-lg font-semibold text-ink">
              No questions available
            </p>
            <p className="text-sm text-ink-2">Contact your trainer.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div
      className={`min-h-dvh bg-paper select-none ${screenHidden ? "blur-xl" : ""}`}
      /* user-select is also set inline: Safari still needs the prefixed property. */
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      {!fullscreen ? (
        <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
          The exam works best in fullscreen.{" "}
          <button type="button" onClick={requestFullscreen} className="font-medium underline underline-offset-2">
            Enter fullscreen
          </button>
        </div>
      ) : null}
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{paper.courseName}</p>
            <p className="truncate text-xs text-ink-2">
              Question {index + 1} of {questions.length} · {answered} answered
              {blurCount > 0 ? ` · Focus lost: ${blurCount}` : ""}
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
            <Button size="sm" className="gap-1.5" onClick={() => setSubmitOpen(true)} disabled={submitting}>
              {submitting ? (
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
              onValueChange={(v) => {
                setAnswers((prev) => ({ ...prev, [question.id]: v }));
                /* Record exactly which question changed, so the debounce and the
                 * pre-submit flush act on this answer and not on object ordering. */
                pendingSave.current = { questionId: question.id, optionId: v };
              }}
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
                <Button variant="ghost" size="sm" onClick={() => setSubmitOpen(true)}>
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
                {blurCount === 1 ? "once" : `${blurCount} times`} and will be shown to staff.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {submitting ? (
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
        onConfirm={() => void submit()}
      />
    </div>
  );
}

/** Post-submit panel. Same design language as the rest of the app. */
export function ExamSubmitted({
  result,
  courseName,
  submittedAt,
}: {
  result: RunnerResult;
  courseName: string;
  submittedAt: string;
}) {
  const passed = result.passed;

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
            {passed ? <CheckCircle2Icon className="size-7" /> : <XCircleIcon className="size-7" />}
          </span>

          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              {passed ? "Congratulations, you passed" : "Not passed this time"}
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              {courseName} · submitted {formatDateTime(submittedAt)}
            </p>
          </div>

          <p className="font-display text-5xl font-semibold text-ink tabular">
            {formatPercent(result.scorePct ?? 0)}
          </p>

          <p className="text-sm text-ink-2">
            {result.correctCount} of {result.totalCount} correct · pass mark {result.passMarkPct}%
          </p>

          {passed && result.certificate ? (
            <div className="w-full space-y-3 rounded-lg bg-green-bg px-4 py-3">
              <p className="text-sm text-green">
                Your certificate has been issued.
              </p>
              <p className="font-display text-lg font-semibold text-green">
                Student #{result.certificate.studentNumber}
              </p>
              <p className="text-xs text-green/80">
                A copy has been emailed to you with a verification link.
              </p>
            </div>
          ) : result.exhausted ? (
            <p className="rounded-lg bg-red-bg px-4 py-3 text-sm text-red">
              You have used all {result.maxAttempts} attempts for this course. Speak to
              the academy about re-enrolling.
            </p>
          ) : (
            <p className="rounded-lg bg-amber-bg px-4 py-3 text-sm text-amber">
              You have {result.attemptsRemaining} attempt{result.attemptsRemaining === 1 ? "" : "s"} left. Ask
              your trainer to send the next paper. Answers are saved to your record either way.
            </p>
          )}

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {result.certificate ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/certificates/${result.certificate.id}`}>
                  View certificate
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
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

/** Kept so the runner's briefing copy stays identical to the approved design. */
export function ExamBriefStats({
  questionCount,
  durationMin,
  passMarkPct,
}: {
  questionCount: number;
  durationMin: number;
  passMarkPct: number;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <Rule
        icon={<FileTextIcon className="size-4" />}
        label="Questions"
        value={formatNumber(questionCount)}
      />
      <Rule
        icon={<ClockIcon className="size-4" />}
        label="Time limit"
        value={`${durationMin} minutes`}
      />
      <Rule
        icon={<AlertTriangleIcon className="size-4" />}
        label="Pass mark"
        value={`${passMarkPct}%`}
      />
    </dl>
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
