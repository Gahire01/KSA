"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  notificationDrawerOpen: boolean;
  commandPaletteOpen: boolean;
  recentPages: { path: string; label: string; at: number }[];
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setMobileNavOpen: (v: boolean) => void;
  setNotificationDrawerOpen: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  pushRecentPage: (path: string, label: string) => void;
  clearRecentPages: () => void;
}

const MAX_RECENT = 5;

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      notificationDrawerOpen: false,
      commandPaletteOpen: false,
      recentPages: [],
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
      setNotificationDrawerOpen: (v) => set({ notificationDrawerOpen: v }),
      setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
      pushRecentPage: (path, label) => {
        const existing = get().recentPages.filter((p) => p.path !== path);
        set({ recentPages: [{ path, label, at: Date.now() }, ...existing].slice(0, MAX_RECENT) });
      },
      clearRecentPages: () => set({ recentPages: [] }),
    }),
    {
      name: "ksa-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        recentPages: state.recentPages,
      }),
    },
  ),
);
