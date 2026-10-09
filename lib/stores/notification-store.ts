"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AppNotification } from "@/lib/types";

export type ConnectionState = "connected" | "reconnecting" | "offline";

interface NotificationState {
  items: AppNotification[];
  connected: ConnectionState;
  lastConnectedAt: number | null;
  /** Live events received this session, newest first. */
  liveFeed: AppNotification[];
  push: (n: AppNotification) => void;
  /** Replaces the list with the server's copy. The server is authoritative. */
  hydrate: (items: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  /** Removes one notification from the list (the caller deletes it server-side). */
  remove: (id: string) => void;
  clearAll: () => void;
  setConnected: (state: ConnectionState) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      /* Starts empty. The demo seeds that used to live here are replaced by
       * `useNotificationHydration()` on mount, so a persisted copy of mock rows
       * can no longer be mistaken for real ones. */
      items: [],
      connected: "connected",
      lastConnectedAt: Date.now(),
      liveFeed: [],
      push: (n) =>
        set((s) => ({
          items: [n, ...s.items.filter((existing) => existing.id !== n.id)].slice(0, 200),
          liveFeed: [n, ...s.liveFeed.filter((existing) => existing.id !== n.id)].slice(0, 25),
        })),
      hydrate: (items) =>
        set((s) => ({
          /* Anything pushed over SSE while the fetch was in flight survives. */
          items: [...items, ...s.liveFeed.filter((live) => !items.some((n) => n.id === live.id))].slice(0, 200),
        })),
      markRead: (id) =>
        set((s) => ({
          items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllRead: () =>
        set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
      remove: (id) =>
        set((s) => ({
          items: s.items.filter((n) => n.id !== id),
          liveFeed: s.liveFeed.filter((n) => n.id !== id),
        })),
      clearAll: () => set({ items: [], liveFeed: [] }),
      setConnected: (state) =>
        set({
          connected: state,
          lastConnectedAt: state === "connected" ? Date.now() : get().lastConnectedAt,
        }),
    }),
    {
      /* v2: an earlier build persisted demo rows under the old key. Moving the key drops
       * them, so only what the server sent (and what was pushed live) can appear. */
      name: "ksa-notifications-v2",
      partialize: (state) => ({ items: state.items.slice(0, 60) }),
    },
  ),
);

export function unreadCount(items: AppNotification[]): number {
  return items.filter((n) => !n.read).length;
}
