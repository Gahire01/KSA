"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { api } from "@/lib/api/client";
import { useNotificationStore } from "@/lib/stores/notification-store";
import type { AppNotification } from "@/lib/types";

/** Server-sent frame for a stored notification. Mirrors `NotificationEvent`. */
interface StreamEvent {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Query keys whose data a notification tells the client has changed. Matching the
 * type here means a "certificate issued" push refreshes the certificate list
 * instead of leaving the user to reload it themselves.
 */
function keysFor(type: string): string[][] {
  switch (type) {
    case "exam.sent":
    case "exam.submitted":
    case "exam.passed":
    case "exam.failed":
    case "exam.link.expiring":
      return [["exams"], ["attempts"], ["trainees"], ["dashboard"]];
    case "payment.recorded":
      return [["payments"], ["trainees"], ["dashboard"]];
    case "trainee.enrolled":
      return [["trainees"], ["courses"], ["dashboard"]];
    case "certificate.issued":
    case "certificate.expiring":
      return [["certificates"], ["dashboard"]];
    case "deadline.approaching":
      return [["trainees"], ["dashboard"]];
    default:
      return [["dashboard"]];
  }
}

function toAppNotification(event: StreamEvent): AppNotification {
  return {
    id: event.id,
    /* The server narrows to the known union before it gets here; anything else
     * arrives as "system", which the client renders without special casing. */
    type: event.type as AppNotification["type"],
    title: event.title,
    body: event.body,
    createdAt: event.createdAt,
    read: event.readAt !== null,
    mention: false,
    link: event.link,
    actorName: "",
  };
}

const MAX_BACKOFF_MS = 30_000;

/**
 * Opens the SSE stream and folds incoming events into the notification store.
 *
 * Uses `EventSource` rather than `fetch` + a reader because the browser owns
 * reconnection, `Last-Event-ID` and heartbeat timing. The manual part is the
 * failure ladder: EventSource retries a network drop on its own, but a 401/403
 * response ends in `CLOSED` and never retries, which is the correct behaviour —
 * reconnecting against a rejected session would spin forever. So `onerror`
 * distinguishes the two and only schedules its own backoff when the browser has
 * given up without a status we should act on.
 */
export function useNotificationStream(enabled = true): void {
  const push = useNotificationStore((s) => s.push);
  const setConnected = useNotificationStore((s) => s.setConnected);
  const queryClient = useQueryClient();
  const router = useRouter();

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const connect = () => {
      if (cancelled) return;

      source = new EventSource("/api/notifications/stream");

      source.addEventListener("open", () => {
        if (cancelled) return;
        attempts = 0;
        setConnected("connected");
      });

      source.addEventListener("notification", (raw) => {
        if (cancelled) return;

        let event: StreamEvent;
        try {
          event = JSON.parse((raw as MessageEvent<string>).data) as StreamEvent;
        } catch {
          return;
        }

        const notification = toAppNotification(event);
        push(notification);

        for (const key of keysFor(event.type)) {
          void queryClient.invalidateQueries({ queryKey: key });
        }

        toast(notification.title, {
          description: notification.body,
          duration: 5000,
          action: notification.link
            ? {
                label: "View",
                onClick: () => router.push(notification.link as string),
              }
            : undefined,
        });
      });

      source.onerror = () => {
        if (cancelled) return;

        /* CONNECTING means the browser is already retrying — stay out of its way
         * and just reflect the state. CLOSED means it gave up (bad status). */
        if (source?.readyState === EventSource.CONNECTING) {
          setConnected("reconnecting");
          return;
        }

        setConnected("offline");
        source?.close();
        source = null;

        attempts += 1;
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempts);
        retryTimer = setTimeout(connect, delay);
      };
    };

    /* A tab that has been backgrounded for hours holds a socket the network has
     * long since dropped; EventSource notices on its own, but reconnecting on
     * focus gets a usable stream back immediately. */
    const onVisible = () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      if (source && source.readyState === EventSource.OPEN) return;
      source?.close();
      source = null;
      attempts = 0;
      connect();
    };

    connect();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
      setConnected("offline");
    };
  }, [enabled, push, setConnected, queryClient, router]);
}

/** Replaces the store's contents with the server's copy on first mount. */
export function useNotificationHydration(enabled = true): void {
  const hydrate = useNotificationStore((s) => s.hydrate);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    void api
      .get<{ items: AppNotification[]; unread: number }>("/notifications")
      .then((page) => {
        /* Whatever was persisted — including the old demo seeds — is replaced
         * wholesale: the server is the only source of truth for this list. */
        if (!cancelled) hydrate(page.items);
      })
      .catch(() => {
        /* Offline: keep whatever is persisted rather than blanking the bell. */
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, hydrate]);
}
