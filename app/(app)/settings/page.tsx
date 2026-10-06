"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2Icon,
  CheckIcon,
  GlobeIcon,
  LoaderIcon,
  LogOutIcon,
  MonitorIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockApi } from "@/lib/mock";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDateTime, formatRelative, sentenceCase, titleCase } from "@/lib/utils/format";
import type { AcademySettings, NotificationChannel, NotificationType } from "@/lib/types";

const CHANNELS: NotificationChannel[] = ["inapp", "email", "whatsapp"];

const EVENT_LABEL: Record<NotificationType, string> = {
  "exam.sent": "Exam link sent",
  "exam.submitted": "Exam submitted",
  "exam.passed": "Exam passed",
  "exam.failed": "Exam failed",
  "payment.recorded": "Payment recorded",
  "trainee.enrolled": "Trainee enrolled",
  "deadline.approaching": "Deadline approaching",
  "certificate.issued": "Certificate issued",
  "exam.link.expiring": "Exam link expiring",
  system: "System announcements",
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [revokeTarget, setRevokeTarget] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => mockApi.settings.get(),
  });
  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: () => mockApi.trainers.list(),
    staleTime: 5 * 60_000,
  });
  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => mockApi.sessions.list(),
  });

  const settings = settingsQuery.data;
  const trainers = trainersQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];

  const [draft, setDraft] = React.useState<AcademySettings | null>(null);
  const form = draft ?? settings ?? null;

  React.useEffect(() => {
    if (settings && !draft) setDraft(settings ?? null);
  }, [settings, draft]);

  const saveMutation = useMutation({
    mutationFn: (values: AcademySettings) => mockApi.settings.update(values),
    onSuccess: (next) => {
      setDraft(next);
      setDirty(false);
      toast.success("Settings saved", {
        description: "Changes apply to new exams, receipts, and certificates immediately.",
      });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: () => toast.error("Settings could not be saved."),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => mockApi.sessions.revoke(id),
    onSuccess: (next) => {
      setRevokeTarget(null);
      toast.success("Session signed out");
      queryClient.setQueryData(["sessions"], next);
    },
    onError: () => toast.error("Could not revoke that session."),
  });

  if (settingsQuery.isLoading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const set = <K extends keyof AcademySettings>(key: K, value: AcademySettings[K]) => {
    setDraft({ ...form, [key]: value });
    setDirty(true);
  };

  const setChannel = (
    type: NotificationType,
    channel: NotificationChannel,
    value: boolean,
  ) => {
    setDraft({
      ...form,
      notificationMatrix: {
        ...form.notificationMatrix,
        [type]: { ...form.notificationMatrix[type], [channel]: value },
      },
    });
    setDirty(true);
  };

  return (
    <div className="space-y-5">

      <PageHeader
        title="Settings"
        subtitle="Academy identity, certification defaults, and notification routing."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(settings ?? null);
                setDirty(false);
              }}
              disabled={!dirty}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => saveMutation.mutate(form)}
              disabled={!dirty || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <CheckIcon className="size-4" />
              )}
              Save changes
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2Icon className="size-4 text-ink-2" />
                Academy profile
              </CardTitle>
              <CardDescription>
                This identity appears on certificates, receipts, and reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Legal name" htmlFor="name">
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field label="Tagline" htmlFor="tagline">
                <Input
                  id="tagline"
                  value={form.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                />
              </Field>
              <Field label="Address" htmlFor="address" className="sm:col-span-2">
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </Field>
              <Field label="City" htmlFor="city">
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Field>
              <Field label="Country" htmlFor="country">
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                />
              </Field>
              <Field label="Phone" htmlFor="phone">
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Website" htmlFor="website">
                <div className="relative">
                  <GlobeIcon
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
                    aria-hidden
                  />
                  <Input
                    id="website"
                    className="pl-9"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Currency" htmlFor="currency">
                <Select
                  value={form.currency}
                  onValueChange={(v) => set("currency", v as AcademySettings["currency"])}
                >
                  <SelectTrigger id="currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RWF">RWF — Rwandan franc</SelectItem>
                    <SelectItem value="USD">USD — US dollar</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheckIcon className="size-4 text-ink-2" />
                Certification defaults
              </CardTitle>
              <CardDescription>
                Applied to new exams and issued certificates.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Default signer" htmlFor="signer">
                <Select
                  value={form.defaultSignerTrainerId}
                  onValueChange={(v) => set("defaultSignerTrainerId", v)}
                >
                  <SelectTrigger id="signer" className="w-full">
                    <SelectValue placeholder="Select a trainer" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} — {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-ink-3">
                  Their signature and stamp appear on certificates they issue.
                </p>
              </Field>
              <Field label="Default pass mark (%)" htmlFor="passMark">
                <Input
                  id="passMark"
                  type="number"
                  min={1}
                  max={100}
                  value={form.defaultPassMarkPct}
                  onChange={(e) => set("defaultPassMarkPct", Number(e.target.value))}
                />
                <p className="mt-1 text-xs text-ink-3">
                  Individual courses can override this value.
                </p>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Notification matrix</CardTitle>
              <CardDescription>
                Choose where each event is delivered. In-app notifications always appear
                in the bell menu.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Event</TableHead>
                    {CHANNELS.map((c) => (
                      <TableHead key={c} className="w-28 text-center">
                        {titleCase(c)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Object.keys(form.notificationMatrix) as NotificationType[]).map((type) => (
                    <TableRow key={type}>
                      <TableCell className="text-sm text-ink">
                        {EVENT_LABEL[type] ?? sentenceCase(type)}
                      </TableCell>
                      {CHANNELS.map((c) => (
                        <TableCell key={c} className="text-center">
                          <Checkbox
                            className="mx-auto"
                            checked={Boolean(form.notificationMatrix[type]?.[c])}
                            onCheckedChange={(v) => setChannel(type, c, Boolean(v))}
                            aria-label={`${EVENT_LABEL[type] ?? type} via ${c}`}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Your account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <AvatarInitials name={currentUser?.name ?? "?"} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {currentUser?.name}
                  </p>
                  <p className="truncate text-xs text-ink-2">{currentUser?.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-2">
                <span className="text-xs text-ink-2">Role</span>
                <Badge variant="outline">{currentUser?.role}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-2">
                <span className="text-xs text-ink-2">Appearance</span>
                <ThemeToggle />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-2">
                <span className="text-xs text-ink-2">Email digest</span>
                <Select
                  value={form.digestMode}
                  onValueChange={(v) => set("digestMode", v as AcademySettings["digestMode"])}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base flex items-center gap-2">
                <MonitorIcon className="size-4 text-ink-2" />
                Active sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessionsQuery.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : sessions.length === 0 ? (
                <p className="text-sm text-ink-2">No other sessions are active.</p>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="rounded-lg border border-line px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {s.device}
                        </p>
                        <p className="truncate text-xs text-ink-2">
                          {s.browser} · {s.location} · {s.ip}
                        </p>
                      </div>
                      {s.current ? (
                        <Badge variant="green">This device</Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Sign out ${s.device}`}
                          onClick={() => setRevokeTarget(s.id)}
                        >
                          <LogOutIcon className="size-4" />
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-ink-3">
                      Last active {formatRelative(s.lastActiveAt)} ·{" "}
                      {formatDateTime(s.lastActiveAt)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(v) => !v && setRevokeTarget(null)}
        title="Sign out this session?"
        description="That device will need to sign in again with a new one-time code."
        confirmLabel="Sign out"
        destructive
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget);
        }}
      />

      {dirty ? (
        <div className="print:hidden">
          <Card className="border-orange/50 bg-orange/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
              <p className="text-sm text-ink">
                You have unsaved changes to the academy settings.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft(settings ?? null);
                    setDirty(false);
                  }}
                >
                  <TrashIcon className="size-3.5" />
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate(form)}
                  disabled={saveMutation.isPending}
                >
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5">
        {label}
      </Label>
      {children}
    </div>
  );
}
