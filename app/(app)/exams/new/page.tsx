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
import { Switch } from "@/components/ui/switch";
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
  summary: { requested: number; sent: number; failed: number; skipped: number; notices: string[] };
}

type Channel = "email" | "whatsapp" | "both";

interface LookupResult {
  configured: boolean;
  items: Array<{ traineeId: string; e164: string | null; whatsapp: "yes" | "no" | "unknown" | "invalid" }>;
}

const WA_LABEL: Record<LookupResult["items"][number]["whatsapp"], string> = {
  yes: "On WhatsApp",
  no: "Not on WhatsApp",
  unknown: "Not checked",
  invalid: "No valid number",
};

export default function SendExamPage() {
  const [courseId, setCourseId] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [result, setResult] = React.useState<SendResult | null>(null);

  /* /exams links here with ?courseId= so "Send exam" opens on the right course. */
  React.useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("courseId");
    if (preset) setCourseId(preset);
  }, []);

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

  const [channel, setChannel] = React.useState<Channel>("email");
  const [verifyWhatsapp, setVerifyWhatsapp] = React.useState(true);

  /* Shows the number each message would go to, and whether it is on WhatsApp. */
  const selectedIds = React.useMemo(() => [...selected].sort(), [selected]);
  const lookupQuery = useQuery({
    queryKey: ["whatsapp-lookup", selectedIds],
    queryFn: () => api.post<LookupResult>("/whatsapp/lookup", { traineeIds: selectedIds.slice(0, 100) }),
    enabled: channel !== "email" && selectedIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const send = useMutation({
    mutationFn: (traineeIds: string[]) =>
      api.post<SendResult>(`/exams/${courseId}/send`, { traineeIds, channel, verifyWhatsapp }),
    onSuccess: (data) => {
      setResult(data);
      if (data.summary.sent > 0) {
        toast.success("Exam link sent. Check inbox within 2 minutes; if not, check spam.", {
          description: `${data.summary.sent} sent`,
        });
      }
      for (const notice of data.summary.notices ?? []) toast.info(notice);
      if (data.summary.failed > 0) {
        toast.error(`${data.summary.failed} could not be delivered`);
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
            Each message carries the link and the code. The code expires in 30 minutes; the
            link works once and expires in 72 hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="channel">Send by</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <SelectTrigger id="channel" className="w-full" aria-label="Channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email only</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp only</SelectItem>
                  <SelectItem value="both">Email and WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {channel !== "email" ? (
              <Label className="flex items-center gap-2 self-end pb-2 text-sm font-normal">
                <Switch checked={verifyWhatsapp} onCheckedChange={setVerifyWhatsapp} aria-label="Verify WhatsApp first" />
                Verify WhatsApp first
              </Label>
            ) : null}
          </div>

          {channel !== "email" && lookupQuery.data && !lookupQuery.data.configured ? (
            <Alert>
              <InfoIcon className="size-4" />
              <AlertDescription>WhatsApp is not configured, so these will go out by email only.</AlertDescription>
            </Alert>
          ) : null}

          {channel !== "email" && lookupQuery.data?.configured ? (
            <ul className="max-h-48 divide-y divide-line overflow-y-auto text-xs">
              {lookupQuery.data.items.map((item) => {
                const t = trainees.find((x) => x.id === item.traineeId);
                return (
                  <li key={item.traineeId} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate font-medium text-ink">{t?.fullName ?? item.traineeId}</span>
                    <span className="shrink-0 font-mono text-ink-2">
                      {item.e164 ?? "-"} · {WA_LABEL[item.whatsapp]}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <Button
            className="gap-1.5"
            disabled={!courseId || selected.size === 0 || send.isPending}
            onClick={() => send.mutate([...selected])}
          >
            {send.isPending ? <LoaderIcon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
            Send to {selected.size} trainee{selected.size === 1 ? "" : "s"}
          </Button>

          {result ? (
            <SendReport
              result={result}
              retrying={send.isPending}
              onRetry={() => send.mutate(result.failed.map((f) => f.traineeId))}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SendReport({
  result,
  onRetry,
  retrying,
}: {
  result: SendResult;
  onRetry: () => void;
  retrying: boolean;
}) {
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
            <p className="font-medium">Could not be delivered</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {result.failed.map((f) => (
                <li key={f.traineeId}>
                  {f.name} — {f.reason}
                </li>
              ))}
            </ul>
            <Button type="button" size="sm" variant="outline" className="mt-2" disabled={retrying} onClick={onRetry}>
              Retry failed
            </Button>
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