"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  AwardIcon,
  InfoIcon,
  ShieldAlertIcon,
  TrendingUpIcon,
  UserCheckIcon,
  UsersIcon,
  UserXIcon,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

import { PageHeader, TodaySubtitle } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DeadlineBadge } from "@/components/shared/DeadlineBadge";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDate, formatNumber, formatTime } from "@/lib/utils/format";

/** GET /api/dashboard: all of it comes from the database. */
interface DashboardData {
  metrics: {
    totalTrainees: { value: number; newThisMonth: number };
    activeCourses: { value: number };
    completed: { value: number };
    examsInProgress: { value: number };
    certificatesThisMonth: { value: number; changePct?: number };
  };
  categories: Array<{ category: string; count: number }>;
  alerts: Array<{ id: string; severity: "info" | "warning" | "critical"; text: string; at: string; link: string }>;
  deadlines: Array<{ traineeId: string; traineeName: string; courseName: string; deadline: string; daysLeft: number }>;
  activity: Array<{ id: string; actorName: string; action: string; at: string }>;
  /** Null for a trainer: money is not theirs to see. */
  revenue: Array<{ month: string; collectedRwf: number; invoiceRwf: number }> | null;
  passRates: Array<{ courseId: string; courseName: string; passRate: number; attempts: number; averageScore: number }>;
  trainerScoped: boolean;
}

/* Recharts is large and needs the browser, so the charts load on demand instead of
 * weighing down the first paint of every dashboard visit. */
const chartLoading = () => <Skeleton className="h-64 w-full" />;
const CategoryPieChart = dynamic(
  () => import("@/components/shared/charts").then((m) => m.CategoryPieChart),
  { ssr: false, loading: chartLoading },
);
const PassRateBarChart = dynamic(
  () => import("@/components/shared/charts").then((m) => m.PassRateBarChart),
  { ssr: false, loading: chartLoading },
);
const RevenueAreaChart = dynamic(
  () => import("@/components/shared/charts").then((m) => m.RevenueAreaChart),
  { ssr: false, loading: chartLoading },
);

const SEVERITY_STYLE = {
  info: { icon: InfoIcon, cls: "text-navy bg-secondary" },
  warning: { icon: AlertTriangleIcon, cls: "text-amber bg-amber-bg" },
  critical: { icon: ShieldAlertIcon, cls: "text-red bg-red-bg" },
} as const;

export default function DashboardPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const role = currentUser?.role ?? "ADMIN";
  const trainerId = role === "TRAINER" ? currentUser?.trainerId : undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", trainerId ?? "all"],
    queryFn: () => api.get<DashboardData>("/dashboard"),
    staleTime: 30_000,
  });

  const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN";

  return (
    <div className="space-y-6">

      <PageHeader
        title={
          <span>
            Good day, {currentUser?.name.split(" ")[0] ?? "there"}
          </span>
        }
        subtitle={<TodaySubtitle prefix="Here's what's happening · " />}
        actions={
          isOwnerOrAdmin ? (
            <Button asChild size="sm" className="no-print">
              <Link href="/trainees/new">Add trainee</Link>
            </Button>
          ) : null
        }
      />

      {isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-ink-2">The dashboard could not be loaded.</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── KPI row ─────────────────────────────────────────────── */}
      <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total trainees"
          value={formatNumber(data?.metrics.totalTrainees.value ?? 0)}
          hint={`${formatNumber(data?.metrics.totalTrainees.newThisMonth ?? 0)} new this month`}
          icon={<UsersIcon className="size-4" />}
          href="/trainees"
          isLoading={isLoading}
        />
        <StatCard
          label="Active courses"
          value={formatNumber(data?.metrics.activeCourses.value ?? 0)}
          hint="on offer now"
          icon={<TrendingUpIcon className="size-4" />}
          href="/courses"
          isLoading={isLoading}
        />
        <StatCard
          label="Completed"
          value={formatNumber(data?.metrics.completed.value ?? 0)}
          hint="certificates this quarter"
          icon={<UserCheckIcon className="size-4" />}
          href="/certificates"
          isLoading={isLoading}
        />
        <StatCard
          label="Exams in progress"
          value={formatNumber(data?.metrics.examsInProgress.value ?? 0)}
          hint="sent or being sat"
          icon={<UserXIcon className="size-4" />}
          href="/exams"
          isLoading={isLoading}
        />
        <StatCard
          label="Certificates issued"
          value={formatNumber(data?.metrics.certificatesThisMonth.value ?? 0)}
          changePct={data?.metrics.certificatesThisMonth.changePct}
          hint="this month"
          icon={<AwardIcon className="size-4" />}
          href="/certificates"
          isLoading={isLoading}
        />
      </section>

      {/* ── Alerts ──────────────────────────────────────────────── */}
      <section aria-label="Alerts" className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : (data?.alerts.length ?? 0) === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-green-bg px-4 py-3 text-sm text-green">
            <UserCheckIcon className="size-4" />
            No outstanding alerts. Everything is on track.
          </div>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data?.alerts.map((alert) => {
              const style = SEVERITY_STYLE[alert.severity];
              const Icon = style.icon;
              return (
                <li key={alert.id}>
                  <Link
                    href={alert.link}
                    className="flex h-full items-start gap-3 rounded-xl border border-line bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${style.cls}`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-ink">{alert.text}</span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {formatRelativeShort(alert.at)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Charts ──────────────────────────────────────────────── */}
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Revenue vs invoiced</CardTitle>
            <CardDescription>
              {isOwnerOrAdmin
                ? "Collected and invoiced amounts over the last six months."
                : "Finance figures are hidden for trainer accounts."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isOwnerOrAdmin ? (
              isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : !data?.revenue || data.revenue.every((p) => p.collectedRwf === 0 && p.invoiceRwf === 0) ? (
                <EmptyState compact title="No payments yet" description="Revenue appears here once payments are recorded." />
              ) : (
                <RevenueAreaChart
                  data={(data?.revenue ?? []).map((p) => ({
                    month: p.month,
                    collected: p.collectedRwf,
                    invoiced: p.invoiceRwf,
                  }))}
                />
              )
            ) : (
              <EmptyState
                title="Not available for your role"
                description="Revenue reporting is limited to owners and administrators."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Trainees by category</CardTitle>
            <CardDescription>Across all active courses.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              (data?.categories.length ?? 0) === 0 ? (
                <EmptyState compact title="No trainees yet" description="Enrol a trainee to see the split by category." />
              ) : (
                <CategoryPieChart
                  data={(data?.categories ?? []).map((c) => ({ label: c.category, value: c.count }))}
                  valueLabel="Trainees"
                />
              )
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Pass rate by course</CardTitle>
            <CardDescription>
              Percentage of trainees passing on their first attempt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              (data?.passRates ?? []).every((p) => p.attempts === 0) ? (
                <EmptyState compact title="No exam results yet" description="Pass rates appear once trainees have sat an exam." />
              ) : (
                <PassRateBarChart
                  data={(data?.passRates ?? []).map((p) => ({
                    label: p.courseName.length > 24 ? `${p.courseName.slice(0, 23)}…` : p.courseName,
                    passRate: p.passRate,
                    averageScore: p.averageScore,
                  }))}
                />
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Upcoming deadlines</CardTitle>
            <CardDescription>Trainees whose deadline is near or has passed.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (data?.deadlines.length ?? 0) === 0 ? (
              <EmptyState compact title="Nothing due" description="No deadlines in the next 30 days." />
            ) : (
              <ul className="divide-y divide-line">
                {data?.deadlines.slice(0, 7).map((row) => (
                  <li key={`${row.traineeId}-${row.deadline}`}>
                    <Link
                      href={`/trainees/${row.traineeId}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
                    >
                      <AvatarInitials name={row.traineeName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {row.traineeName}
                        </span>
                        <span className="block truncate text-xs text-ink-2">
                          {row.courseName}
                        </span>
                      </span>
                      <DeadlineBadge days={row.daysLeft} dateLabel={formatDate(row.deadline)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Activity ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>Live feed of changes across the academy.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="activity">
            <TabsList>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="audit">Full audit log</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (data?.activity.length ?? 0) === 0 ? (
                <EmptyState compact title="No activity yet" />
              ) : (
                <ol className="space-y-0">
                  {data?.activity.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-line py-2.5 last:border-0"
                    >
                      <AvatarInitials name={row.actorName} size="xs" />
                      <span className="text-sm text-ink">
                        <span className="font-medium">{row.actorName}</span> {row.action}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-ink-3 tabular">
                        {formatTime(row.at)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <p className="text-sm text-ink-2">
                The audit log keeps every change permanently, including who made it
                and when.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href="/audit-log">Open audit log</Link>
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function formatRelativeShort(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return formatDate(iso);
  }
}
