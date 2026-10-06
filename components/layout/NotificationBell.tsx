"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { unreadCount, useNotificationStore } from "@/lib/stores/notification-store";

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const items = useNotificationStore((s) => s.items);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const connected = useNotificationStore((s) => s.connected);

  const sorted = React.useMemo(
    () => [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [items],
  );
  const unread = unreadCount(items);

  /* The store flips the flag first so the UI answers instantly; the API call is
   * best-effort. A failure leaves the server stale but the next hydration
   * corrects it, which is a better trade than a spinner on every click. */
  const persistRead = (id?: string) => {
    void api.post("/notifications", id ? { id } : { all: true }).catch(() => {
      /* Offline — the optimistic update stands. */
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications, none unread"
          }
        >
          <BellIcon className="size-4.5" />
          {unread > 0 ? (
            <span
              className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-orange text-[10px] leading-none font-semibold text-white"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="font-display text-sm font-semibold text-ink">Notifications</p>
            <p className="flex items-center gap-1.5 text-xs text-ink-2">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  connected === "connected" ? "bg-green" : "bg-amber",
                )}
              />
              {connected === "connected"
                ? "Live updates on"
                : connected === "reconnecting"
                  ? "Reconnecting…"
                  : "Offline"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                markAllRead();
                persistRead();
              }}
              disabled={unread === 0}
              aria-label="Mark all as read"
              title="Mark all read"
            >
              <CheckCheckIcon className="size-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[26rem]">
          {sorted.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-2">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sorted.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) {
                        markRead(n.id);
                        persistRead(n.id);
                      }
                      if (n.link && n.link !== pathname) router.push(n.link);
                    }}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
                      n.read ? "opacity-60" : "bg-orange-bg/40",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        n.read ? "bg-transparent" : "bg-orange",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-ink">
                          {n.actorName ? (
                            <span className="mr-1 text-ink-2">{n.actorName}</span>
                          ) : null}
                          {n.title}
                        </span>
                        <span className="shrink-0 text-[11px] whitespace-nowrap text-ink-3">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-2">{n.body}</span>
                      {n.mention ? (
                        <Badge variant="orange" className="mt-1.5">
                          Mentioned you
                        </Badge>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
