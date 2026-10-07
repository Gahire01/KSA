"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CopyButton } from "@/components/shared/CopyButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDateTime } from "@/lib/utils/format";

/**
 * /exams/[id]/attempts/[attemptId] — one sitting as staff see it: the state of
 * the emailed link with its three controls, and the integrity flags raised
 * during the exam.
 */

interface AttemptDetail {
  id: string;
  status: string;
  attemptNumber: number;
  scorePct: number | null;
  blurCount: number;
  startedAt: string | null;
  submittedAt: string | null;
  linkExpiresAt: string | null;
  linkUses: number;
  linkMaxUses: number;
  firstOpenedAt: string | null;
  firstOpenedIp: string | null;
  firstOpenedUa: string | null;
  linkState: "ok" | "expired" | "used";
  trainee: { fullName: string; email: string; traineeNo: string };
  course: { name: string; code: string; passMarkPct: number };
  flags: Array<{ index: number; type: string; at: string | null; reviewed: boolean }>;
}

type LinkAction = "extend" | "reset" | "reissue";

const FLAG_LABEL: Record<string, string> = {
  blur: "Focus lost",
  focus_blur: "Focus lost",
  too_many_blurs: "Too many focus losses (auto-submitted)",
  copy_attempt: "Copy attempted",
  cut_attempt: "Cut attempted",
  paste_attempt: "Paste attempted",
  contextmenu: "Right-click attempted",
  shortcut: "Blocked shortcut used",
  print_attempt: "Screenshot / print key pressed",
  devtools_suspected: "Developer tools suspected",
  tab_switch: "Switched tab",
};

const CONFIRM: Record<LinkAction, { title: string; body: string; label: string }> = {
  extend: {
    title: "Extend the link by 24 hours?",
    body: "The link will stay usable for 24 more hours from its current expiry (or from now, if it has already expired).",
    label: "Extend +24h",
  },
  reset: {
    title: "Reset the link's uses?",
    body: "The trainee can open the link again and is emailed a fresh code. A paper already started keeps its original start time.",
    label: "Reset uses",
  },
  reissue: {
    title: "Issue a new link?",
    body: "The old link stops working immediately. The trainee is emailed a new link and code, and you get the new link once to share.",
    label: "Reissue link",
  },
};

export default function AttemptLinkPage() {
  const params = useParams<{ id: string; attemptId: string }>();
  const attemptId = params.attemptId;
  const queryClient = useQueryClient();
  const isOwner = useAuthStore((s) => s.currentUser?.role) === "OWNER";
  const [pending, setPending] = React.useState<LinkAction | null>(null);
  const [newUrl, setNewUrl] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => api.get<AttemptDetail>(`/attempts/${attemptId}`),
  });

  const act = useMutation({
    mutationFn: (action: LinkAction) =>
      api.post<{ url?: string }>(`/attempts/${attemptId}/link`, { action }),
    onSuccess: (data, action) => {
      setPending(null);
      if (action === "reissue" && data.url) setNewUrl(data.url);
      toast.success(
        action === "extend" ? "Link extended" : action === "reset" ? "Link reset, new code emailed" : "New link emailed",
      );
      void queryClient.invalidateQueries({ queryKey: ["attempt", attemptId] });
    },
    onError: (error: Error) => {
      setPending(null);
      toast.error(error.message);
    },
  });

  const grant = useMutation({
    mutationFn: () => api.post(`/attempts/${attemptId}/grant`),
    onSuccess: () => {
      toast.success("Another attempt granted and emailed");
      void queryClient.invalidateQueries({ queryKey: ["attempt", attemptId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const review = useMutation({
    mutationFn: (v: { index: number; reviewed: boolean }) => api.patch(`/attempts/${attemptId}/flags`, v),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["attempt", attemptId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const a = query.data;
  if (!a) {
    return (
      <div className="space-y-4">
        <PageHeader title="Attempt not found" description="It may have been removed." />
        <Button asChild variant="outline">
          <Link href="/exams">Back to exams</Link>
        </Button>
      </div>
    );
  }

  const open = a.status === "PENDING" || a.status === "STARTED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${a.trainee.fullName} · attempt ${a.attemptNumber}`}
        description={`${a.course.name} (${a.course.code}) · ${a.status}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Exam link</CardTitle>
          <CardDescription>Expiry, use count and first open. Every action here is audited.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-2">State</dt>
              <dd>
                <Badge variant={a.linkState === "ok" ? "green" : "amber"}>
                  {a.linkState === "ok" ? "Usable" : a.linkState === "expired" ? "Expired" : "Used"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-ink-2">Expires</dt>
              <dd>{a.linkExpiresAt ? formatDateTime(a.linkExpiresAt) : "Not set (counts as expired)"}</dd>
            </div>
            <div>
              <dt className="text-ink-2">Uses</dt>
              <dd>
                {a.linkUses} / {a.linkMaxUses}
              </dd>
            </div>
            <div>
              <dt className="text-ink-2">First opened</dt>
              <dd>{a.firstOpenedAt ? formatDateTime(a.firstOpenedAt) : "Not yet"}</dd>
            </div>
            <div>
              <dt className="text-ink-2">First opened from (IP)</dt>
              <dd className="font-mono text-xs">{a.firstOpenedIp ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-ink-2">First opened with</dt>
              <dd className="break-all text-xs">{a.firstOpenedUa ?? "-"}</dd>
            </div>
          </dl>

          {open ? (
            <div className="flex flex-wrap gap-2">
              {(["extend", "reset", "reissue"] as const).map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant="outline"
                  disabled={act.isPending}
                  onClick={() => setPending(action)}
                >
                  {CONFIRM[action].label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-2">This sitting is finished, so its link can no longer be changed.</p>
          )}

          {isOwner && a.status === "FAILED" ? (
            <div className="space-y-2 rounded-lg border border-line p-3">
              <p className="text-sm font-medium">Grant another attempt</p>
              <p className="text-xs text-ink-2">
                This trainee has used every attempt. Granting one more emails them a fresh link and code, and
                reopens their enrolment. This is recorded in the audit log.
              </p>
              <Button type="button" variant="outline" size="sm" disabled={grant.isPending} onClick={() => grant.mutate()}>
                Grant attempt {a.attemptNumber + 1}
              </Button>
            </div>
          ) : null}

          {newUrl ? (
            <div className="space-y-2 rounded-lg border border-amber-400 p-3">
              <p className="text-sm font-medium">New link (shown once, also emailed to the trainee)</p>
              <p className="font-mono text-xs break-all">{newUrl}</p>
              <div className="flex gap-2">
                <CopyButton value={newUrl} variant="button" label="Copy link" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setNewUrl(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrity flags</CardTitle>
          <CardDescription>
            What the exam runner reported. Some signals are best-effort, so treat them as prompts to look,
            not proof. Focus losses: {a.blurCount}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {a.flags.length === 0 ? (
            <p className="text-sm text-ink-2">No flags were raised.</p>
          ) : (
            <ul className="divide-y divide-line">
              {a.flags.map((flag) => (
                <li key={flag.index} className="flex items-center gap-3 py-2 text-sm">
                  <Checkbox
                    id={`flag-${flag.index}`}
                    checked={flag.reviewed}
                    disabled={review.isPending}
                    onCheckedChange={(v) => review.mutate({ index: flag.index, reviewed: v === true })}
                  />
                  <label htmlFor={`flag-${flag.index}`} className="flex-1">
                    {FLAG_LABEL[flag.type] ?? flag.type}
                  </label>
                  <span className="text-xs text-ink-2">{flag.at ? formatDateTime(flag.at) : ""}</span>
                  {flag.reviewed ? <Badge variant="neutral">Reviewed</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o) setPending(null);
          }}
          title={CONFIRM[pending].title}
          description={CONFIRM[pending].body}
          confirmLabel={CONFIRM[pending].label}
          onConfirm={() => act.mutate(pending)}
        />
      ) : null}
    </div>
  );
}
