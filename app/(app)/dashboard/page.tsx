"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CalendarClockIcon,
  DownloadIcon,
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
import { mockApi } from "@/lib/mock";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  CATEGORY_LABEL,
  formatDate,
  formatNumber,
  formatTime,
} from "@/lib/utils/format";

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
const Sparkline = dynamic(() => import("@/components/shared/charts").then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <Skeleton className="h-8 w-24" />,
});

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
    queryFn: () => mockApi.dashboard.get(trainerId),
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
          <>
            <Button variant="outline" size="sm" className="gap-1.5 no-print">
              <DownloadIcon className="size-4" />
              Export summary
            </Button>
            {isOwnerOrAdmin ? (
              <Button asChild size="sm" className="no-print">
                <Link href="/trainees/new">Add trainee</Link>
              </Button>
            ) : null}
          </>
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
          changePct={data?.metrics.totalTrainees.changePct}
          hint="vs last month"
          icon={<UsersIcon className="size-4" />}
          href="/trainees"
          isLoading={isLoading}
        />
        <StatCard
          label="Active courses"
          value={formatNumber(data?.metrics.active.value ?? 0)}
          changePct={data?.metrics.active.changePct}
          hint="running now"
          icon={<TrendingUpIcon className="size-4" />}
          href="/courses"
          isLoading={isLoading}
        />
        <StatCard
          label="Completed"
          value={formatNumber(data?.metrics.completed.value ?? 0)}
          changePct={data?.metrics.completed.changePct}
          hint="this quarter"
          icon={<UserCheckIcon className="size-4" />}
          href="/trainees?statuses=COMPLETED"
          isLoading={isLoading}
        />
        <StatCard
          label="Pending review"
          value={formatNumber(data?.metrics.pending.value ?? 0)}
          changePct={data?.metrics.pending.changePct}
          hint="awaiting action"
          icon={<UserXIcon className="size-4" />}
          href="/exams?statuses=PENDING_REVIEW"
          isLoading={isLoading}
        />
        <StatCard
          label="Attendance today"
          value={formatNumber(data?.metrics.todayAttendance.value ?? 0)}
          changePct={data?.metrics.todayAttendance.changePct}
          icon={<CalendarClockIcon className="size-4" />}
          isLoading={isLoading}
        >
          <div className="mt-1">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Sparkline
                data={data?.metrics.todayAttendance.spark ?? []}
                label="Attendance over the last seven days"
              />
            )}
          </div>
        </StatCard>
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
              <CategoryPieChart
                data={(data?.categories ?? []).map((c) => ({
                  label: CATEGORY_LABEL[c.category] ?? c.category,
                  value: c.count,
                }))}
                valueLabel="Trainees"
              />
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
              <PassRateBarChart
                data={(data?.passRates ?? []).map((p) => ({
                  label: p.courseName.length > 24 ? `${p.courseName.slice(0, 23)}…` : p.courseName,
                  passRate: p.passRate,
                  averageScore: p.averageScore,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Upcoming deadlines</CardTitle>
            <CardDescription>Next exams and certificates.</CardDescription>
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
                        <span className="font-medium">{row.actorName}</span>{" "}
                        {row.action.toLowerCase().replaceAll("_", " ")}{" "}
                        <span className="text-ink-2">{row.target}</span>
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
