"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AwardIcon,
  BookOpenIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeadlineBadge } from "@/components/shared/DeadlineBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api/client";
import { useCourses, useDeleteTrainee, useTrainee } from "@/lib/api/hooks";
import {
  categoryLabel,
  daysBetween,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRwf,
  formatTime,
} from "@/lib/utils/format";
import { useAuthStore } from "@/lib/stores/auth-store";

/** What the trainee has done, from GET /api/trainees/:id/activity. */
interface TraineeActivity {
  attempts: Array<{
    id: string;
    courseId: string;
    courseName: string;
    status: string;
    attemptNumber: number;
    scorePct: number | null;
    startedAt: string | null;
    createdAt: string;
  }>;
  certificates: Array<{
    id: string;
    courseId: string;
    courseName: string;
    studentNumber: number;
    status: "VALID" | "REVOKED";
  }>;
  /** Null for a trainer: money is not theirs to see. */
  payments: Array<{
    id: string;
    receiptNo: string;
    amountRwf: number;
    method: string;
    paidAt: string;
    isRefund: boolean;
  }> | null;
}

/* Courses for the select dropdown; bounded by the API's MAX_PAGE_SIZE. */
const COURSE_OPTION_LIMIT = 100;

const ENROLLMENT_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  COMPLETED: "Completed",
  FAILED: "Failed",
  WITHDRAWN: "Withdrawn",
};

const ATTEMPT_LABEL: Record<string, string> = {
  PENDING: "Sent, not opened",
  STARTED: "In progress",
  SUBMITTED: "Not passed",
  PASSED: "Passed",
  FAILED: "Failed",
  VOID: "Void",
};

export default function TraineeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const role = useAuthStore((s) => s.currentUser?.role ?? "ADMIN");
  const isTrainer = role === "TRAINER";

  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const { data: trainee, isLoading, isError } = useTrainee(id);

  const deleteMutation = useDeleteTrainee();

  const confirmRemove = () =>
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Trainee removed", { description: "The record has been deleted." });
        router.push("/trainees");
      },
      onError: (error) =>
        toast.error("Could not delete that trainee.", {
          description: error instanceof ApiError ? error.message : undefined,
        }),
    });

  const coursesQuery = useCourses({ page: 1, pageSize: COURSE_OPTION_LIMIT });
  const courseName = React.useCallback(
    (courseId: string) =>
      coursesQuery.data?.items.find((c) => c.id === courseId)?.name ?? "—",
    [coursesQuery.data],
  );

  const activityQuery = useQuery({
    queryKey: ["trainee-activity", id],
    queryFn: () => api.get<TraineeActivity>(`/trainees/${encodeURIComponent(id)}/activity`),
    enabled: Boolean(id),
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !trainee) {
    return (
      <EmptyState
        title="Trainee not found"
        description="This record may have been removed, or the link is incorrect."
        action={
          <Button asChild size="sm">
            <Link href="/trainees">Back to trainees</Link>
          </Button>
        }
      />
    );
  }

  const payments = activityQuery.data?.payments ?? [];
  const attempts = activityQuery.data?.attempts ?? [];
  const certificates = activityQuery.data?.certificates ?? [];

  const balance = Math.max(0, trainee.totalDueRwf - trainee.amountPaidRwf);
  const paidPct = trainee.totalDueRwf
    ? Math.min(100, Math.round((trainee.amountPaidRwf / trainee.totalDueRwf) * 100))
    : 100;

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbSlot={
          <nav aria-label="Breadcrumb">
            <Link
              href="/trainees"
              className="text-sm text-ink-2 transition-colors hover:text-ink"
            >
              ← Trainees
            </Link>
          </nav>
        }
        title={trainee.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-xs">{trainee.traineeNo}</span>
            <span aria-hidden>·</span>
            <span>{categoryLabel(trainee.category)}</span>
            <span aria-hidden>·</span>
            <span>{courseName(trainee.courseId)}</span>
          </span>
        }
        actions={
          <>
            {!isTrainer ? (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href={`/trainees/${trainee.id}/edit`}>
                  <PencilIcon className="size-4" />
                  Edit
                </Link>
              </Button>
            ) : null}
            {!isTrainer ? (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/payments/new?traineeId=${trainee.id}`}>
                  <CreditCardIcon className="size-4" />
                  Record payment
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {/* ── Summary ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex gap-4">
            <AvatarInitials name={trainee.name} size="xl" />
            <dl className="min-w-0 flex-1 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <dt className="sr-only">Status</dt>
                <dd>
                  <StatusBadge
                    status={trainee.status}
                    label={ENROLLMENT_LABEL[trainee.status] ?? trainee.status}
                  />
                </dd>
                {!isTrainer ? (
                  <dd>
                    <StatusBadge status={trainee.paymentStatus} size="sm" />
                  </dd>
                ) : null}
                <dd>
                  <DeadlineBadge days={daysBetween(new Date(), trainee.deadline)} />
                </dd>
              </div>

              <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <MailIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                  <dt className="sr-only">Email</dt>
                  <dd className="min-w-0">
                    <a
                      href={`mailto:${trainee.email}`}
                      className="block truncate text-ink underline decoration-line underline-offset-2 transition-colors hover:decoration-orange"
                    >
                      {trainee.email}
                    </a>
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <PhoneIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                  <dt className="sr-only">Phone</dt>
                  <dd className="truncate text-ink">{trainee.phone}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <UserRoundIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                  <dt className="sr-only">Country</dt>
                  <dd className="text-ink">{trainee.country}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpenIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                  <dt className="sr-only">Enrolled</dt>
                  <dd className="text-ink">Enrolled {formatDate(trainee.enrolledAt)}</dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="space-y-3">
            {!isTrainer ? (
              <div className="rounded-lg border border-line bg-paper p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wider text-ink-2 uppercase">
                    Fee balance
                  </p>
                  <p className="font-display text-lg font-semibold text-ink tabular">
                    {formatRwf(balance)}
                  </p>
                </div>
                <Progress value={paidPct} className="mt-2" aria-label="Fee payment progress" />
                <p className="mt-1.5 text-xs text-ink-2 tabular">
                  {formatRwf(trainee.amountPaidRwf)} paid of{" "}
                  {formatRwf(trainee.totalDueRwf)} ({paidPct}%)
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2">
              <Metric label="Certificates" value={formatNumber(certificates.length)} />
              <Metric
                label="Best score"
                value={
                  attempts.some((a) => a.scorePct !== null)
                    ? `${formatNumber(Math.max(...attempts.map((a) => a.scorePct ?? 0)))}%`
                    : "—"
                }
              />
              <Metric
                label="Exams taken"
                value={formatNumber(attempts.length)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {trainee.notes ? (
        <Card>
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-sm">Staff notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line text-ink-2">{trainee.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Tabs ────────────────────────────────────────────────── */}

      <Card>
        <CardContent className="p-5">
          <Tabs defaultValue="attempts">
            <TabsList>
              <TabsTrigger value="attempts">Exam attempts</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="certificates">Certificates</TabsTrigger>
            </TabsList>

            <TabsContent value="attempts" className="mt-4">
              {attempts.length === 0 ? (
                <EmptyState compact title="No exam attempts yet" description="Attempts appear here once the trainee sits an exam." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam</TableHead>
                      <TableHead>Attempt</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead className="text-right">Review</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-ink">{a.courseName}</TableCell>
                        <TableCell className="tabular text-ink-2">#{a.attemptNumber}</TableCell>
                        <TableCell className="whitespace-nowrap text-ink-2">
                          {formatDateTime(a.startedAt ?? a.createdAt)}
                        </TableCell>
                        <TableCell className="tabular">
                          {a.scorePct === null ? "—" : `${formatNumber(a.scorePct)}%`}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} label={ATTEMPT_LABEL[a.status]} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/exams/${a.courseId}/attempts/${a.id}`}>Open</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              {isTrainer ? (
                <EmptyState
                  compact
                  title="Not available for your role"
                  description="Payment records are limited to owners and administrators."
                />
              ) : payments.length === 0 ? (
                <EmptyState compact title="No payments recorded" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                        <TableHead>Receipt no.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.receiptNo}</TableCell>
                        <TableCell className="whitespace-nowrap text-ink-2">
                          {formatDate(p.paidAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{p.method}</Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium tabular ${p.amountRwf < 0 ? "text-red" : ""}`}
                        >
                          {formatRwf(p.amountRwf)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/payments/${p.id}`}>Open</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="certificates" className="mt-4">
              {certificates.length === 0 ? (
                <EmptyState
                  compact
                  title="No certificates yet"
                  description="Certificates are issued automatically once an exam is passed."
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {certificates.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/certificates/${c.id}`}
                        className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
                      >
                        <span
                          aria-hidden
                          className="flex size-10 items-center justify-center rounded-lg bg-orange-bg text-orange-d"
                        >
                          <AwardIcon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {c.courseName}
                          </span>
                          <span className="block font-mono text-xs text-ink-3">
                            Student #{c.studentNumber}
                          </span>
                        </span>
                        <StatusBadge status={c.status} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>

      {!isTrainer ? (
        <>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-3">
              Last updated {formatDateTime(trainee.updatedAt)} · record created{" "}
              {formatTime(trainee.createdAt)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href={`/exams/new?courseId=${trainee.courseId}`}>
                  <ClipboardCheckIcon className="size-4" />
                  Send exam
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-red"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon className="size-4" />
                Delete trainee
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this trainee?"
        description={`${trainee.name} and their exam history will be permanently removed from the database. This cannot be undone.`}
        confirmLabel="Delete trainee"
        destructive
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2">
      <p className="text-[10px] font-semibold tracking-wider text-ink-2 uppercase">{label}</p>
      <p className="mt-0.5 font-display text-base font-semibold text-ink tabular">{value}</p>
    </div>
  );
}
