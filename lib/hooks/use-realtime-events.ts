"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import type { AppNotification } from "@/lib/types";
import {
  pickEventTemplate,
  useNotificationStore,
} from "@/lib/stores/notification-store";

const MIN_INTERVAL = 25_000;
const MAX_INTERVAL = 45_000;
const RECONNECT_EVERY = 5 * 60_000;
const RECONNECT_DURATION = 3_000;

let counter = 0;

/**
 * Mock SSE. Emits a plausible event every 25–45s, occasionally simulates a
 * brief reconnect, pushes to the notification store, raises a sonner toast
 * and invalidates the affected TanStack Query keys.
 */
export function useRealtimeEvents(enabled = true): void {
  const push = useNotificationStore((s) => s.push);
  const setConnected = useNotificationStore((s) => s.setConnected);
  const queryClient = useQueryClient();
  const router = useRouter();

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let eventTimer: ReturnType<typeof setTimeout>;

    const nextDelay = () => MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);

    const invalidate = (type: string) => {
      const keys: string[][] = [];
      switch (type) {
        case "exam.submitted":
        case "exam.link.expiring":
          keys.push(["exams"], ["attempts"], ["trainees"]);
          break;
        case "payment.recorded":
          keys.push(["payments"], ["trainees"], ["dashboard"]);
          break;
        case "trainee.enrolled":
          keys.push(["trainees"], ["dashboard"]);
          break;
        case "deadline.approaching":
          keys.push(["trainees"], ["dashboard"]);
          break;
        case "certificate.expiring":
        case "certificate.issued":
          keys.push(["certificates"], ["dashboard"]);
          break;
        default:
          keys.push(["dashboard"]);
      }
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };

    const schedule = () => {
      if (cancelled) return;
      eventTimer = setTimeout(emit, nextDelay());
    };

    const emit = () => {
      if (cancelled) return;
      const template = pickEventTemplate();
      const content = template.build();
      counter += 1;

      const notification: AppNotification = {
        id: `live_${Date.now().toString(36)}_${counter}`,
        type: template.type,
        title: content.title,
        body: content.body,
        createdAt: new Date().toISOString(),
        read: false,
        mention: false,
        link: content.link,
        actorName: content.actorName,
      };

      push(notification);
      invalidate(template.type);

      toast(content.title, {
        description: content.body,
        duration: 4000,
        action: content.link
          ? {
              label: "View",
              onClick: () => router.push(content.link as string),
            }
          : undefined,
      });

      schedule();
    };

    schedule();

    /* Simulated connection blips every ~5 minutes. */
    const reconnectTimer = setInterval(() => {
      if (cancelled) return;
      setConnected("reconnecting");
      setTimeout(() => {
        if (cancelled) return;
        setConnected("connected");
      }, RECONNECT_DURATION);
    }, RECONNECT_EVERY);

    return () => {
      cancelled = true;
      clearTimeout(eventTimer);
      clearInterval(reconnectTimer);
      setConnected("connected");
    };
  }, [enabled, push, setConnected, queryClient, router]);
}
