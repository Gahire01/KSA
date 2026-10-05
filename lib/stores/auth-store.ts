"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CurrentUser, Role } from "@/lib/types";

/**
 * Client-side mirror of the server session.
 *
 * As of Phase 1 this store is NOT the security boundary — the session cookie and
 * the server layout guard are. It only carries the signed-in user's role into
 * the sidebar, top bar and command palette, which are client components. It is
 * hydrated from `GET /api/auth/me`, so it can never grant access on its own.
 */
interface AuthState {
  currentUser: CurrentUser | null;
  mfaPassed: boolean;
  /** Populated once, from the server, so the UI can show a real name/role. */
  setSession: (user: CurrentUser, mfaPassed: boolean) => void;
  setMfaPassed: (mfaPassed: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      mfaPassed: false,
      setSession: (currentUser, mfaPassed) => set({ currentUser, mfaPassed }),
      setMfaPassed: (mfaPassed) => set({ mfaPassed }),
      clearSession: () => set({ currentUser: null, mfaPassed: false }),
    }),
    { name: "ksa-auth" },
  ),
);

export function canAccess(role: Role, segment: string): boolean {
  if (role === "OWNER" || role === "ADMIN") return true;
  const deniedForTrainer = ["payments", "settings", "audit-log", "trainers"];
  return !deniedForTrainer.includes(segment);
}

export const ROUTE_ACCESS: Record<string, Role[]> = {
  dashboard: ["OWNER", "ADMIN", "TRAINER"],
  trainees: ["OWNER", "ADMIN", "TRAINER"],
  courses: ["OWNER", "ADMIN", "TRAINER"],
  exams: ["OWNER", "ADMIN", "TRAINER"],
  certificates: ["OWNER", "ADMIN", "TRAINER"],
  payments: ["OWNER", "ADMIN"],
  trainers: ["OWNER", "ADMIN"],
  reports: ["OWNER", "ADMIN"],
  "audit-log": ["OWNER", "ADMIN"],
  settings: ["OWNER", "ADMIN"],
};
