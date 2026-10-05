"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, InfoIcon, LoaderIcon, SendIcon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils/format";

/**
 * Send an exam.
 *
 * The flow the client asked for: pick a course, pick the trainees, send. Each
 * trainee gets their own link, their own frozen paper and their own six-digit
 * code.
 *
 * The response reports per-trainee outcomes, because a batch email is exactly
 * where a single bad address would otherwise go unnoticed.
 */

interface CourseOption {
  id: string;
  name: string;
  code: string;
  examDurationMin: number;
  passMarkPct: number;
  maxAttempts: number;
}

interface TraineeRow {
  id: string;
  fullName: string;
  email: string;
  traineeNo: string;
  status: string;
}

interface SendResult {
  sent: Array<{ traineeId: string; name: string; email: string; url: string }>;
  failed: Array<{ traineeId: string; name: string; reason: string }>;
  skipped: Array<{ traineeId: string; name: string; reason: string }>;
  summary: { requested: number; sent: number; failed: number; skipped: number };
}

export default function SendExamPage() {
  const [courseId, setCourseId] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [result, setResult] = React.useState<SendResult | null>(null);

  const coursesQuery = useQuery({
    queryKey: ["courses", "send-options"],
    queryFn: async () => {
      const page = await api.get<{ items: CourseOption[] }>("/courses", { pageSize: 100 });
      return page.items;
    },
    staleTime: 5 * 60_000,
  });

  const traineesQuery = useQuery({
    queryKey: ["trainees", "send-options", courseId],
    queryFn: async () => {
      const page = await api.get<{ items: TraineeRow[] }>("/trainees", {
        courseId,
        pageSize: 100,
      });
      return page.items;
    },
    enabled: Boolean(courseId),
    staleTime: 30_000,
  });

  const send = useMutation({
    mutationFn: (traineeIds: string[]) =>
      api.post<SendResult>(`/exams/${courseId}/send`, { traineeIds }),
    onSuccess: (data) => {
      setResult(data);
      if (data.summary.sent > 0) {
        toast.success(`${data.summary.sent} exam link${data.summary.sent === 1 ? "" : "s"} sent`);
      }
      if (data.summary.failed > 0) {
        toast.error(`${data.summary.failed} email${data.summary.failed === 1 ? "" : "s"} failed`);
      }
    },
    onError: (error) => {
      toast.error("Could not send the exam", {
        description: error instanceof ApiError ? error.message : "Try again in a moment.",
      });
    },
  });

  const courses = coursesQuery.data ?? [];
  const trainees = traineesQuery.data ?? [];
  const course = courses.find((c) => c.id === courseId);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = trainees.length > 0 && selected.size === trainees.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send an exam"
        description="Each trainee gets a private link and a six-digit code that expires in 30 minutes."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/exams">Back to exams</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">1. Choose the course</CardTitle>
          <CardDescription>
            Questions, pass mark and time limit all come from the course.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coursesQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={courseId} onValueChange={(v) => { setCourseId(v); setSelected(new Set()); setResult(null); }}>
              <SelectTrigger className="w-full" aria-label="Course">
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {course ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <Fact label="Time limit" value={`${course.examDurationMin} min`} />
              <Fact label="Pass mark" value={`${course.passMarkPct}%`} />
              <Fact label="Attempts allowed" value={String(course.maxAttempts)} />
            </dl>
          ) : null}
        </CardContent>
      </Card>

      {courseId ? (
        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">2. Choose the trainees</CardTitle>
            <CardDescription>
              Everyone enrolled on this course who has attempts left.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {traineesQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : trainees.length === 0 ? (
              <p className="text-sm text-ink-2">
                No trainees are enrolled on this course yet.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <Label className="flex items-center gap-2 text-sm font-medium text-ink">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() =>
                        setSelected(allSelected ? new Set() : new Set(trainees.map((t) => t.id)))
                      }
                      aria-label="Select all"
                    />
                    Select all ({trainees.length})
                  </Label>
                  <span className="text-xs text-ink-2">
                    {selected.size} selected
                  </span>
                </div>

                <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                  {trainees.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                      <Label className="flex min-w-0 flex-1 items-center gap-3 text-sm font-normal">
                        <Checkbox
                          checked={selected.has(t.id)}
                          onCheckedChange={() => toggle(t.id)}
                          aria-label={`Send to ${t.fullName}`}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{t.fullName}</span>
                          <span className="block truncate text-xs text-ink-2">
                            {t.traineeNo} · {t.email}
                          </span>
                        </span>
                      </Label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">3. Send</CardTitle>
          <CardDescription>
            Each email carries the link and the code. The code expires in 30 minutes; the
            link expires in 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="gap-1.5"
            disabled={!courseId || selected.size === 0 || send.isPending}
            onClick={() => send.mutate([...selected])}
          >
            {send.isPending ? <LoaderIcon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
            Send to {selected.size} trainee{selected.size === 1 ? "" : "s"}
          </Button>

          {result ? <SendReport result={result} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SendReport({ result }: { result: SendResult }) {
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        {result.summary.sent > 0 ? (
          <CheckCircle2Icon className="size-4 text-green" />
        ) : (
          <XCircleIcon className="size-4 text-red" />
        )}
        {result.summary.sent} sent
        {result.summary.failed > 0 ? `, ${result.summary.failed} failed` : ""}
        {result.summary.skipped > 0 ? `, ${result.summary.skipped} skipped` : ""}
      </p>

      {result.skipped.length > 0 ? (
        <Alert>
          <InfoIcon className="size-4" />
          <AlertDescription>
            <p className="font-medium text-ink">Skipped</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {result.skipped.map((s) => (
                <li key={s.traineeId}>
                  {s.name} — {s.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {result.failed.length > 0 ? (
        <Alert variant="destructive">
          <XCircleIcon className="size-4" />
          <AlertDescription>
            <p className="font-medium">Email failed</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {result.failed.map((f) => (
                <li key={f.traineeId}>
                  {f.name} — {f.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {result.sent.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-ink-2">
            Links sent at {formatDateTime(new Date().toISOString())}. Copy one if a trainee
            did not receive their email:
          </p>
          <ul className="space-y-1">
            {result.sent.map((s) => (
              <li key={s.traineeId} className="text-xs">
                <span className="font-medium text-ink">{s.name}</span>
                <span className="ml-2 break-all font-mono text-ink-2">{s.url}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2.5">
      <dt className="text-[11px] font-semibold tracking-wider text-ink-2 uppercase">{label}</dt>
      <dd className="mt-0.5 font-display text-base font-semibold text-ink">{value}</dd>
    </div>
  );
}