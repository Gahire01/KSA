"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArchiveIcon,
  BarChart3Icon,
  ClipboardListIcon,
  ClockIcon,
  FileTextIcon,
  ListChecksIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SendIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BarTrendChart } from "@/components/shared/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mockApi } from "@/lib/mock";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Difficulty } from "@/lib/types";
import {
  categoryLabel,
  formatDate,
  formatDurationLabel,
  formatNumber,
  formatRwf,
} from "@/lib/utils/format";

const DIFFICULTY_TONE: Record<number, "green" | "amber" | "red"> = {
  1: "green",
  2: "amber",
  3: "red",
};

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
};

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const canManage = role === "OWNER" || role === "ADMIN";

  const [addOpen, setAddOpen] = React.useState(false);
  const [deleteQuestion, setDeleteQuestion] = React.useState<string | null>(null);

  const courseQuery = useQuery({
    queryKey: ["course", id],
    queryFn: () => mockApi.courses.get(id),
    enabled: Boolean(id),
  });
  const questionsQuery = useQuery({
    queryKey: ["questions", id],
    queryFn: () => mockApi.questions.listByCourse(id),
    enabled: Boolean(id),
  });
  const analyticsQuery = useQuery({
    queryKey: ["course-analytics", id],
    queryFn: () => mockApi.courses.analytics(id),
    enabled: Boolean(id),
  });
  const trainersQuery = useQuery({
    queryKey: ["trainers", "options"],
    queryFn: () => mockApi.trainers.list(),
    staleTime: 5 * 60_000,
  });

  const course = courseQuery.data;

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof mockApi.courses.update>[1]) =>
      mockApi.courses.update(id, input),
    onSuccess: () => {
      toast.success("Course updated");
      void queryClient.invalidateQueries({ queryKey: ["course", id] });
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: (input: {
      courseId: string;
      text: string;
      options: string[];
      correctIndex: number;
      difficulty: Difficulty;
      explanation: string;
    }) => mockApi.questions.create(input),
    onSuccess: () => {
      toast.success("Question added to the bank");
      setAddOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["questions", id] });
      void queryClient.invalidateQueries({ queryKey: ["course", id] });
    },
    onError: () => toast.error("Could not add that question."),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => mockApi.questions.remove(questionId),
    onSuccess: () => {
      toast.success("Question removed");
      void queryClient.invalidateQueries({ queryKey: ["questions", id] });
    },
  });

  if (courseQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (!course) {
    return (
      <EmptyState
        title="Course not found"
        description="This course may have been removed."
        action={
          <Button asChild size="sm">
            <Link href="/courses">Back to courses</Link>
          </Button>
        }
      />
    );
  }

  const trainer = trainersQuery.data?.find((t) => t.id === course.trainerId);
  const analytics = analyticsQuery.data;
  const questions = questionsQuery.data ?? [];
  const distribution = analytics?.attemptsDistribution;

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbSlot={
          <Link href="/courses" className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Courses
          </Link>
        }
        title={course.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-xs">{course.code}</span>
            <span aria-hidden>·</span>
            <span>{categoryLabel(course.category)}</span>
            <span aria-hidden>·</span>
            <span>{formatNumber(course.enrolledCount)} enrolled</span>
          </span>
        }
        actions={
          <>
            {canManage ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  updateMutation.mutate({ isActive: !course.isActive })
                }
                disabled={updateMutation.isPending}
              >
                {course.isActive ? (
                  <>
                    <ArchiveIcon className="size-4" />
                    Archive
                  </>
                ) : (
                  <>
                    <RotateCcwIcon className="size-4" />
                    Reactivate
                  </>
                )}
              </Button>
            ) : null}
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/exams/new?courseId=${course.id}`}>
                <SendIcon className="size-4" />
                Schedule exam
              </Link>
            </Button>
            {canManage ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => router.push(`/courses/${course.id}/edit`)}
              >
                <Link href={`/courses/${course.id}/edit`}>
                  <PencilIcon className="size-4" />
                  Edit
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {/* ── Facts ───────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Fact
          icon={<ClockIcon className="size-4" />}
          label="Duration"
          value={formatDurationLabel(course.durationValue, course.durationUnit)}
        />
        <Fact
          icon={<ListChecksIcon className="size-4" />}
          label="Question bank"
          value={formatNumber(course.questionCount)}
        />
        <Fact
          icon={<BarChart3Icon className="size-4" />}
          label="Pass mark"
          value={`${course.passMarkPct}%`}
        />
        <Fact
          icon={<UsersIcon className="size-4" />}
          label="Max attempts"
          value={formatNumber(course.maxAttempts)}
        />
        <Fact
          icon={<FileTextIcon className="size-4" />}
          label="Fee"
          value={formatRwf(course.priceRwf)}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-ink-2">{course.description}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {trainer ? (
              <span className="flex items-center gap-2">
                <AvatarInitials name={trainer.name} size="sm" />
                <span>
                  <span className="block font-medium text-ink">{trainer.name}</span>
                  <span className="block text-xs text-ink-2">Lead trainer</span>
                </span>
              </span>
            ) : null}
            <span className="text-ink-2">
              Certificate valid for{" "}
              <span className="font-medium text-ink">
                {course.validityMonths
                  ? formatDurationLabel(course.validityMonths, "month")
                  : "no expiry"}
              </span>
            </span>
            <span className="text-ink-2">
              Exam time limit{" "}
              <span className="font-medium text-ink">{course.examDurationMin} minutes</span>
            </span>
            <span className="text-ink-2">
              Created <span className="font-medium text-ink">{formatDate(course.createdAt)}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <Tabs defaultValue="questions">
            <TabsList>
              <TabsTrigger value="questions">
                Question bank ({questions.length})
              </TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Questions */}
            <TabsContent value="questions" className="mt-4">
              {canManage ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ink-2">
                    Each exam serves a shuffled subset of this bank.
                  </p>
                  <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                    <PlusIcon className="size-4" />
                    Add question
                  </Button>
                </div>
              ) : null}

              {questionsQuery.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : questions.length === 0 ? (
                <EmptyState
                  compact
                  title="No questions yet"
                  description="Add questions to this course so exams can be served."
                />
              ) : (
                <ul className="space-y-2">
                  {questions.map((q, i) => {
                    const correct = q.options.find((o) => o.isCorrect);
                    return (
                      <li
                        key={q.id}
                        className="rounded-xl border border-line bg-paper p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="flex gap-2 text-sm font-medium text-ink">
                            <span className="font-mono text-xs text-ink-3">
                              Q{i + 1}
                            </span>
                            <span className="min-w-0 flex-1">{q.text}</span>
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Badge
                              variant={DIFFICULTY_TONE[q.difficulty] ?? "outline"}
                              size="sm"
                            >
                              {DIFFICULTY_LABEL[q.difficulty] ?? `Level ${q.difficulty}`}
                            </Badge>
                            {canManage ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Delete question"
                                onClick={() => setDeleteQuestion(q.id)}
                                className="text-red"
                              >
                                <Trash2Icon className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {q.options.map((o) => (
                            <li
                              key={o.id}
                              className={
                                o.isCorrect
                                  ? "rounded-md border border-green/40 bg-green-bg px-2.5 py-1.5 text-xs text-green"
                                  : "rounded-md border border-line bg-card px-2.5 py-1.5 text-xs text-ink-2"
                              }
                            >
                              {o.text}
                            </li>
                          ))}
                        </ul>

                        <p className="mt-2 text-xs text-ink-3">
                          Served {formatNumber(q.timesServed)}× · correct{" "}
                          {q.timesServed ? Math.round((q.timesCorrect / q.timesServed) * 100) : 0}%
                          {correct ? " · answer: " + correct.text : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            {/* Analytics */}
            <TabsContent value="analytics" className="mt-4 space-y-4">
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Fact
                      icon={<BarChart3Icon className="size-4" />}
                      label="Pass rate"
                      value={`${analytics?.passRate ?? 0}%`}
                    />
                    <Fact
                      icon={<ClipboardListIcon className="size-4" />}
                      label="Avg score"
                      value={`${analytics?.averageScore ?? 0}%`}
                    />
                    <Fact
                      icon={<ListChecksIcon className="size-4" />}
                      label="Passed"
                      value={formatNumber(distribution?.passed ?? 0)}
                    />
                    <Fact
                      icon={<ClipboardListIcon className="size-4" />}
                      label="Failed"
                      value={formatNumber(distribution?.failed ?? 0)}
                    />
                  </div>

                  {analytics && analytics.questionSuccess.length > 0 ? (
                    <>
                      <div>
                        <h3 className="mb-2 font-display text-sm font-semibold text-ink">
                          Hardest questions
                        </h3>
                        <BarTrendChart
                          height={280}
                          valueLabel="Success rate"
                          valueFormatter={(v) => `${v}%`}
                          data={analytics.questionSuccess
                            .slice()
                            .sort((a, b) => a.successRate - b.successRate)
                            .slice(0, 8)
                            .map((q) => ({
                              label:
                                q.text.length > 26
                                  ? `${q.text.slice(0, 25)}…`
                                  : q.text,
                              successRate: q.successRate,
                            }))}
                        />
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </TabsContent>

            {/* Settings */}
            <TabsContent value="settings" className="mt-4">
              <div className="max-w-md space-y-4">
                <div className="flex items-start justify-between gap-4 rounded-lg border border-line p-4">
                  <div>
                    <p className="text-sm font-medium text-ink">Course is active</p>
                    <p className="text-xs text-ink-2">
                      Archived courses stay visible on past certificates but cannot
                      receive new enrolments.
                    </p>
                  </div>
                  <Switch
                    checked={course.isActive}
                    disabled={!canManage || updateMutation.isPending}
                    onCheckedChange={(v) => updateMutation.mutate({ isActive: v })}
                    aria-label="Course is active"
                  />
                </div>

                <dl className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2">
                  <Detail label="Pass mark" value={`${course.passMarkPct}%`} />
                  <Detail label="Max attempts" value={formatNumber(course.maxAttempts)} />
                  <Detail label="Exam duration" value={`${course.examDurationMin} min`} />
                  <Detail
                    label="Validity"
                    value={
                      course.validityMonths
                        ? formatDurationLabel(course.validityMonths, "month")
                        : "No expiry"
                    }
                  />
                </dl>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AddQuestionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        courseId={course.id}
        nextPosition={questions.length + 1}
        onSubmit={(values) => addQuestionMutation.mutate(values)}
        isPending={addQuestionMutation.isPending}
      />

      <ConfirmDialog
        open={deleteQuestion !== null}
        onOpenChange={(open) => !open && setDeleteQuestion(null)}
        title="Remove this question?"
        description="It will no longer appear in future exams. Past attempts keep their recorded answers."
        confirmLabel="Remove question"
        destructive
        onConfirm={() => {
          if (deleteQuestion) deleteQuestionMutation.mutate(deleteQuestion);
        }}
      />
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
  value: string;
}) {
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wider text-ink-2 uppercase">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function AddQuestionDialog({
  open,
  onOpenChange,
  courseId,
  nextPosition,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  nextPosition: number;
  onSubmit: (values: {
    courseId: string;
    text: string;
    options: string[];
    correctIndex: number;
    difficulty: Difficulty;
    explanation: string;
  }) => void;
  isPending: boolean;
}) {
  const [text, setText] = React.useState("");
  const [explanation, setExplanation] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<Difficulty>(2);
  const [options, setOptions] = React.useState([
    { id: "a", text: "", isCorrect: true },
    { id: "b", text: "", isCorrect: false },
  ]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setText("");
      setExplanation("");
      setDifficulty(2);
      setOptions([
        { id: "a", text: "", isCorrect: true },
        { id: "b", text: "", isCorrect: false },
      ]);
      setError(null);
    }
  }, [open]);

  const submit = () => {
    if (text.trim().length < 8) {
      setError("Write a question of at least 8 characters.");
      return;
    }
    const filled = options
      .map((o, i) => ({ ...o, index: i }))
      .filter((o) => o.text.trim().length > 0);
    if (filled.length < 2) {
      setError("Provide at least two answer options.");
      return;
    }
    const correct = filled.find((o) => o.isCorrect);
    if (!correct) {
      setError("Mark one option as the correct answer.");
      return;
    }
    onSubmit({
      courseId,
      text: text.trim(),
      options: filled.map((o) => o.text.trim()),
      correctIndex: correct.index,
      difficulty,
      explanation: explanation.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add question #{nextPosition}</DialogTitle>
          <DialogDescription>
            Questions are shuffled per attempt, so ordering here does not matter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-text">Question</Label>
            <Textarea
              id="q-text"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. What is the first action when you discover a fire?"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium text-ink">Answer options</legend>
            {options.map((option, index) => (
              <div key={option.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct-option"
                  checked={option.isCorrect}
                  onChange={() =>
                    setOptions((prev) =>
                      prev.map((o) => ({ ...o, isCorrect: o.id === option.id })),
                    )
                  }
                  aria-label={`Mark option ${index + 1} as correct`}
                  className="size-4 accent-[var(--orange)]"
                />
                <Input
                  value={option.text}
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((o) =>
                        o.id === option.id ? { ...o, text: e.target.value } : o,
                      ),
                    )
                  }
                  placeholder={`Option ${index + 1}`}
                  aria-label={`Option ${index + 1}`}
                />
                {options.length > 2 ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() =>
                      setOptions((prev) =>
                        prev.filter((o) => o.id !== option.id),
                      )
                    }
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                setOptions((prev) => [
                  ...prev,
                  {
                    id: String.fromCharCode(97 + prev.length),
                    text: "",
                    isCorrect: false,
                  },
                ])
              }
            >
              <PlusIcon className="size-3.5" />
              Add option
            </Button>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="q-difficulty">Difficulty</Label>
            <select
              id="q-difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value) as Difficulty)}
              className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
            >
              <option value={1}>Easy</option>
              <option value={2}>Medium</option>
              <option value={3}>Hard</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="q-explanation">Explanation (shown after the exam)</Label>
            <Textarea
              id="q-explanation"
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Why the correct answer is correct…"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Adding…" : "Add question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
