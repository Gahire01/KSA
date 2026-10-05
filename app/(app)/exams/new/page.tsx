"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarPlusIcon, InfoIcon, SendIcon, ShuffleIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { mockApi } from "@/lib/mock";
import { formatDateTime } from "@/lib/utils/format";

const schema = z.object({
  courseId: z.string().min(1, "Choose the course being examined"),
  title: z.string().min(4, "Give the exam a recognisable title").max(90),
  questionsToServe: z.coerce.number().int().min(1, "Serve at least 1 question").max(60),
  durationMin: z.coerce.number().int().min(5, "Minimum 5 minutes").max(240),
  passMarkPct: z.coerce.number().int().min(1).max(100),
  maxAttempts: z.coerce.number().int().min(1).max(10),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  closesAt: z.string().optional(),
  notes: z.string().max(280).optional(),
});

type FormValues = z.input<typeof schema>;

export default function NewExamPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const coursesQuery = useQuery({
    queryKey: ["courses", "options"],
    queryFn: () => mockApi.courses.list(),
    staleTime: 5 * 60_000,
  });
  const courses = coursesQuery.data ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: "",
      title: "",
      questionsToServe: 8,
      durationMin: 45,
      passMarkPct: 70,
      maxAttempts: 2,
      shuffleQuestions: true,
      shuffleOptions: true,
      closesAt: "",
      notes: "",
    },
  });

  const courseId = watch("courseId");
  const course = courses.find((c) => c.id === courseId);

  React.useEffect(() => {
    if (!course) return;
    setValue("passMarkPct", course.passMarkPct);
    setValue("maxAttempts", course.maxAttempts);
    setValue("durationMin", course.examDurationMin);
    setValue("questionsToServe", Math.min(course.questionCount, 8));
    setValue("title", `${course.name} — assessment`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const recipientsQuery = useQuery({
    queryKey: ["exam-recipients", "preview", courseId],
    queryFn: () => mockApi.exams.previewRecipients(courseId),
    enabled: Boolean(courseId),
  });
  const recipients = recipientsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const exam = await mockApi.exams.create({
        courseId: values.courseId,
        title: values.title,
        questionsToServe: Number(values.questionsToServe),
        durationMin: Number(values.durationMin),
        passMarkPct: Number(values.passMarkPct),
        maxAttempts: Number(values.maxAttempts),
        shuffleQuestions: values.shuffleQuestions,
        shuffleOptions: values.shuffleOptions,
        opensAt: null,
        closesAt: values.closesAt ? new Date(values.closesAt).toISOString() : null,
      });
      return exam;
    },
    onSuccess: (exam) => {
      toast.success("Exam created", {
        description: "Review recipients, then send individual links.",
      });
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["exam"] });
      router.push(`/exams/${exam.id}`);
    },
    onError: () => toast.error("The exam could not be created."),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <DemoBanner>
        Exams, question banks and attempts are demo data. Scheduling an exam here
        does not send anything or store a record.
      </DemoBanner>

      <PageHeader
        breadcrumbSlot={
          <Link href="/exams" className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Exams
          </Link>
        }
        title="Schedule an exam"
        subtitle="Create the paper, then send each enrolled trainee a single-use link."
      />

      <form
        onSubmit={handleSubmit((v) => createMutation.mutate(v))}
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="space-y-5">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Paper</CardTitle>
              <CardDescription>
                Defaults come from the course, so the common case is a single choice.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="courseId">Course</Label>
                <Select
                  value={courseId}
                  onValueChange={(v) => setValue("courseId", v, { shouldValidate: true })}
                >
                  <SelectTrigger id="courseId" className="w-full">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.questionCount} questions in the bank
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.courseId ? <p className="text-xs text-red">{errors.courseId.message}</p> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="title">Exam title</Label>
                <Input id="title" placeholder="Fire Safety Level 1 — assessment" {...register("title")} />
                {errors.title ? <p className="text-xs text-red">{errors.title.message}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="questionsToServe">Questions to serve</Label>
                  <Input
                    id="questionsToServe"
                    type="number"
                    min={1}
                    max={60}
                    {...register("questionsToServe")}
                  />
                  <p className="text-xs text-ink-3">
                    {course
                      ? `${course.questionCount} available in the bank for this course.`
                      : "Pick a course to see the question bank size."}
                  </p>
                  {errors.questionsToServe ? (
                    <p className="text-xs text-red">{errors.questionsToServe.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="durationMin">Time limit (minutes)</Label>
                  <Input
                    id="durationMin"
                    type="number"
                    min={5}
                    max={240}
                    {...register("durationMin")}
                  />
                  {errors.durationMin ? (
                    <p className="text-xs text-red">{errors.durationMin.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="passMarkPct">Pass mark (%)</Label>
                  <Input
                    id="passMarkPct"
                    type="number"
                    min={1}
                    max={100}
                    {...register("passMarkPct")}
                  />
                  {errors.passMarkPct ? (
                    <p className="text-xs text-red">{errors.passMarkPct.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxAttempts">Max attempts</Label>
                  <Input
                    id="maxAttempts"
                    type="number"
                    min={1}
                    max={10}
                    {...register("maxAttempts")}
                  />
                  {errors.maxAttempts ? (
                    <p className="text-xs text-red">{errors.maxAttempts.message}</p>
                  ) : null}
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">Integrity</legend>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line px-3 py-2.5">
                  <Checkbox
                    checked={Boolean(watch("shuffleQuestions"))}
                    onCheckedChange={(v) => setValue("shuffleQuestions", Boolean(v))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      <ShuffleIcon className="size-3.5" />
                      Shuffle questions per attempt
                    </span>
                    <span className="text-xs text-ink-2">
                      A seeded shuffle keeps every attempt reproducible for review.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line px-3 py-2.5">
                  <Checkbox
                    checked={Boolean(watch("shuffleOptions"))}
                    onCheckedChange={(v) => setValue("shuffleOptions", Boolean(v))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      <ShuffleIcon className="size-3.5" />
                      Shuffle answer options
                    </span>
                    <span className="text-xs text-ink-2">
                      Prevents positional guessing for multiple-choice questions.
                    </span>
                  </span>
                </label>
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor="closesAt">Link closes (optional)</Label>
                <Input
                  id="closesAt"
                  type="datetime-local"
                  {...register("closesAt")}
                />
                <p className="text-xs text-ink-3">
                  After this moment the link stops accepting submissions.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Internal notes (optional)</Label>
                <Textarea id="notes" rows={2} {...register("notes")} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="gap-1">
              <CardTitle className="text-base flex items-center gap-2">
                <UsersIcon className="size-4 text-ink-2" />
                Recipients
              </CardTitle>
              <CardDescription>Trainees currently enrolled in the selected course.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!courseId ? (
                <p className="rounded-lg bg-paper px-3 py-2 text-sm text-ink-2">
                  Choose a course to preview the recipient list.
                </p>
              ) : recipientsQuery.isLoading ? (
                <p className="text-sm text-ink-3">Loading…</p>
              ) : recipients.length === 0 ? (
                <p className="rounded-lg bg-amber-bg px-3 py-2 text-sm text-amber">
                  Nobody is enrolled in this course yet. You can still create the exam and
                  enrol trainees later.
                </p>
              ) : (
                <>
                  <p className="text-sm text-ink-2">
                    <span className="font-semibold text-ink">{recipients.length}</span> trainee
                    {recipients.length === 1 ? "" : "s"} will receive a link.
                  </p>
                  <ul className="max-h-56 space-y-1.5 overflow-auto">
                    {recipients.slice(0, 8).map((t) => (
                      <li key={t.id} className="flex items-center gap-2 text-sm">
                        <AvatarInitials name={t.name} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-ink-2">{t.name}</span>
                        <span className="font-mono text-[10px] text-ink-3">{t.traineeNo}</span>
                      </li>
                    ))}
                    {recipients.length > 8 ? (
                      <li className="px-1 text-xs text-ink-3">
                        + {recipients.length - 8} more
                      </li>
                    ) : null}
                  </ul>
                </>
              )}

              <p className="flex items-start gap-1.5 rounded-lg bg-paper px-3 py-2 text-xs text-ink-2">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                Links are single-use and tied to the trainee, so a paper cannot be
                forwarded to someone else.
              </p>

              <Button type="submit" className="w-full gap-1.5" disabled={createMutation.isPending}>
                <CalendarPlusIcon className="size-4" />
                {createMutation.isPending ? "Creating…" : "Create exam"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => router.push("/exams")}
              >
                <SendIcon className="size-3.5" />
                Cancel
              </Button>
            </CardContent>
          </Card>

          {watch("closesAt") ? (
            <p className="text-xs text-ink-3">
              Links close {formatDateTime(new Date(String(watch("closesAt"))).toISOString())}.
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
