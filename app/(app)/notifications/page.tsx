"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheckIcon, InboxIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterChips, type Chip } from "@/components/shared/FilterChips";
import { api } from "@/lib/api/client";
import { useNotificationHydration, useNotificationStream } from "@/lib/hooks/use-notification-stream";
import { unreadCount, useNotificationStore } from "@/lib/stores/notification-store";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import type { NotificationType } from "@/lib/types";

type Tab = "all" | "unread";

const TYPE_TONE: Record<NotificationType, string> = {
  "exam.sent": "bg-orange/10 text-orange",
  "exam.submitted": "bg-navy/10 text-navy",
  "exam.passed": "bg-green-bg text-green",
  "exam.failed": "bg-red-bg text-red",
  "payment.recorded": "bg-green-bg text-green",
  "trainee.enrolled": "bg-navy/10 text-navy",
  "deadline.approaching": "bg-amber-bg text-amber",
  "certificate.issued": "bg-green-bg text-green",
  "certificate.revoked": "bg-red-bg text-red",
  "exam.link.expiring": "bg-amber-bg text-amber",
  system: "bg-muted text-ink-2",
};

/**
 * Notification centre — the full list behind the topbar bell.
 *
 * Reads the same zustand store the bell does, so the two never disagree: an item
 * marked read here is read in the bell and in the unread badge without a refetch.
 * The SSE stream and server hydration are mounted here as well, so the page is
 * correct even when it is opened directly from a cold URL.
 */
export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("all");
  const [pending, setPending] = React.useState(false);

  useNotificationHydration(true);
  useNotificationStream(true);

  const items = useNotificationStore((s) => s.items);
  const connected = useNotificationStore((s) => s.connected);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const remove = useNotificationStore((s) => s.remove);
  const clearAll = useNotificationStore((s) => s.clearAll);

  const visible = React.useMemo(
    () =>
      [...items]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .filter((n) => (tab === "unread" ? !n.read : true)),
    [items, tab],
  );

  const unread = unreadCount(items);

  /* The store flips locally first; the API call follows. Same trade as the bell:
   * instant feedback, self-correcting on the next hydration. */
  const persistAll = async () => {
    setPending(true);
    markAllRead();
    try {
      await api.post("/notifications", { all: true });
    } catch {
      /* Offline — the optimistic update stands. */
    } finally {
      setPending(false);
    }
  };

  const chips: Chip[] = [];
  if (tab === "unread") {
    chips.push({
      id: "tab",
      label: "Showing",
      value: "Unread only",
      onRemove: () => setTab("all"),
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread — ${connected === "connected" ? "live updates on" : connected === "reconnecting" ? "reconnecting…" : "offline"}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setTab(tab === "unread" ? "all" : "unread")}
            >
              <InboxIcon className="size-3.5" />
              {tab === "unread" ? "Show all" : "Unread only"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void persistAll()}
              disabled={unread === 0 || pending}
            >
              <CheckCheckIcon className="size-3.5" />
              Mark all read
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                clearAll();
                void api.delete("/notifications", { all: true }).catch(() => {});
              }}
              disabled={items.length === 0}
            >
              <Trash2Icon className="size-3.5" />
              Clear all
            </Button>
          </div>
        }
      />

      <FilterChips chips={chips} onClearAll={() => setTab("all")} clearLabel="Clear filters" />

      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <EmptyState
              title="You're all caught up."
              description={
                tab === "unread"
                  ? "Every notification has been read."
                  : "New activity (exam results, certificates, enrolments) will appear here as it happens."
              }
              action={
                tab === "unread" ? (
                  <Button size="sm" variant="outline" onClick={() => setTab("all")}>
                    <RefreshCwIcon className="mr-1.5 size-3.5" />
                    Show all
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((n) => (
                <li key={n.id} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      void api.post("/notifications", { id: n.id }).catch(() => {});
                      if (n.link) router.push(n.link);
                    }}
                    className={cn(
                      "flex w-full gap-3 py-3.5 pr-12 pl-4 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
                      n.read ? "opacity-70" : "bg-orange-bg/30",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-2 size-2 shrink-0 rounded-full",
                        n.read ? "bg-transparent" : "bg-orange",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{n.title}</span>
                        <Badge variant="orange" className="font-mono text-[10px]">
                          {n.type}
                        </Badge>
                        <span className="ml-auto shrink-0 text-[11px] whitespace-nowrap text-ink-3">
                          {formatDateTime(n.createdAt)}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-ink-2">{n.body}</span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-ink-3">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-medium",
                            TYPE_TONE[n.type] ?? TYPE_TONE.system,
                          )}
                        >
                          {n.type}
                        </span>
                        <span>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove(n.id);
                      void api.delete("/notifications", { id: n.id }).catch(() => {});
                    }}
                    aria-label={`Delete notification: ${n.title}`}
                    title="Delete"
                    className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
                  >
                    <XIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
