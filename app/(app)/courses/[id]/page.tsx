"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArchiveIcon,
  BarChart3Icon,
  ClockIcon,
  FileTextIcon,
  ListChecksIcon,
  PencilIcon,
  RotateCcwIcon,
  SendIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api/client";
import { useCourse, useUpdateCourse } from "@/lib/api/hooks";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  categoryLabel,
  formatDate,
  formatDurationLabel,
  formatNumber,
  formatRwf,
} from "@/lib/utils/format";

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const canManage = role === "OWNER" || role === "ADMIN";

  const courseQuery = useCourse(id);
  const updateMutation = useUpdateCourse();

  const course = courseQuery.data;

  const questionsQuery = useQuery({
    queryKey: ["exam-questions", id],
    queryFn: () => api.get<{ items: Array<{ id: string; isActive: boolean }> }>("/questions", { courseId: id }),
    enabled: Boolean(id),
  });
  const questions = questionsQuery.data?.items ?? [];

  const trainersQuery = useQuery({
    queryKey: ["trainers", "options"],
    queryFn: async () =>
      (await api.get<{ items: Array<{ id: string; name: string | null; email: string }> }>("/trainers")).items.map(
        (t) => ({ id: t.id, name: t.name ?? t.email }),
      ),
    staleTime: 5 * 60_000,
  });

  const setActive = (isActive: boolean) =>
    updateMutation.mutate(
      { id, input: { isActive } },
      {
        onSuccess: () => toast.success("Course updated"),
        onError: (error) =>
          toast.error("Could not update the course.", {
            description: error instanceof ApiError ? error.message : undefined,
          }),
      },
    );

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
                onClick={() => setActive(!course.isActive)}
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
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Questions */}
            <TabsContent value="questions" className="mt-4">
              <EmptyState
                compact
                title={questions.length === 0 ? "No questions yet." : `${questions.length} questions in the bank`}
                description={
                  questions.length === 0
                    ? `Upload via /exams/${course.id}/import.`
                    : "Open the exam page to read the bank, import more questions or review sittings."
                }
                action={
                  <Button asChild size="sm">
                    <Link href={`/exams/${course.id}`}>{questions.length === 0 ? "Open exam page" : "Question bank"}</Link>
                  </Button>
                }
              />
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
                    onCheckedChange={(v) => setActive(v)}
                    aria-label="Course is active"
                  />
                </div>

                <dl className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2">
                  <Detail label="Pass mark" value={`${course.passMarkPct}%`} />
                  <Detail label="Max attempts" value={formatNumber(course.maxAttempts)} />
                  <Detail label="Exam duration" value={`${course.examDurationMin} min`} />
                </dl>
              </div>
            </TabsContent>
          </Tabs>
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

