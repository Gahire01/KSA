"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AppNotification, NotificationType } from "@/lib/types";
import { notifications as seedNotifications } from "@/lib/mock/notifications";

export type ConnectionState = "connected" | "reconnecting" | "offline";

interface NotificationState {
  items: AppNotification[];
  connected: ConnectionState;
  lastConnectedAt: number | null;
  /** Live events received this session, newest first. */
  liveFeed: AppNotification[];
  push: (n: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setConnected: (state: ConnectionState) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: seedNotifications,
      connected: "connected",
      lastConnectedAt: Date.now(),
      liveFeed: [],
      push: (n) =>
        set((s) => ({
          items: [n, ...s.items].slice(0, 200),
          liveFeed: [n, ...s.liveFeed].slice(0, 25),
        })),
      markRead: (id) =>
        set((s) => ({
          items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllRead: () =>
        set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
      setConnected: (state) =>
        set({ connected: state, lastConnectedAt: state === "connected" ? Date.now() : get().lastConnectedAt }),
      reset: () =>
        set({ items: seedNotifications, liveFeed: [], connected: "connected", lastConnectedAt: Date.now() }),
    }),
    {
      name: "ksa-notifications",
      partialize: (state) => ({ items: state.items.slice(0, 60) }),
    },
  ),
);

export function unreadCount(items: AppNotification[]): number {
  return items.filter((n) => !n.read).length;
}

export const EVENT_TEMPLATES: {
  type: NotificationType;
  weight: number;
  build: () => { title: string; body: string; link: string | null; actorName: string };
}[] = [
  {
    type: "exam.submitted",
    weight: 25,
    build: () => ({
      title: "Exam submitted",
      body: "Eric Mugisha submitted Fire Safety Level 1 with 82%.",
      link: "/exams",
      actorName: "Eric Mugisha",
    }),
  },
  {
    type: "payment.recorded",
    weight: 15,
    build: () => ({
      title: "Payment recorded",
      body: "45,000 RWF recorded for Clarisse Uwase via MoMo.",
      link: "/payments",
      actorName: "Sandrine Uwimana",
    }),
  },
  {
    type: "trainee.enrolled",
    weight: 15,
    build: () => ({
      title: "New trainee",
      body: "Patrick Habimana was enrolled in Working at Height.",
      link: "/trainees",
      actorName: "Aline Mukamana",
    }),
  },
  {
    type: "deadline.approaching",
    weight: 15,
    build: () => ({
      title: "Deadlines approaching",
      body: "3 trainees have exams due in the next 48 hours.",
      link: "/trainees",
      actorName: "System",
    }),
  },
  {
    type: "certificate.expiring",
    weight: 10,
    build: () => ({
      title: "Certificates expiring",
      body: "2 certificates expire in 30 days.",
      link: "/certificates",
      actorName: "System",
    }),
  },
  {
    type: "certificate.issued",
    weight: 10,
    build: () => ({
      title: "Certificate issued",
      body: "Certificate issued to Diane Niyonsaba.",
      link: "/certificates",
      actorName: "Claudine Uwase",
    }),
  },
  {
    type: "exam.link.expiring",
    weight: 10,
    build: () => ({
      title: "Exam links expiring",
      body: "Fire Safety Level 1 exam links expire today.",
      link: "/exams",
      actorName: "System",
    }),
  },
];

const TOTAL_WEIGHT = EVENT_TEMPLATES.reduce((s, t) => s + t.weight, 0);

export function pickEventTemplate(): (typeof EVENT_TEMPLATES)[number] {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const t of EVENT_TEMPLATES) {
    roll -= t.weight;
    if (roll <= 0) return t;
  }
  return EVENT_TEMPLATES[0]!;
}
