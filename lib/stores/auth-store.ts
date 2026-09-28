"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CurrentUser, Role } from "@/lib/types";

interface AuthState {
  currentUser: CurrentUser | null;
  /** Set by /login, consumed by /login/mfa. */
  pendingEmail: string | null;
  mfaVerifiedFor: string | null;
  login: (email: string) => CurrentUser;
  logout: () => void;
  setPendingEmail: (email: string | null) => void;
  verifyMfa: () => void;
}

const NAME_BY_EMAIL: Record<string, string> = {
  owner: "Aline Mukamana",
  trainer: "Eric Mugisha",
};

function buildUser(email: string): CurrentUser {
  const lower = email.toLowerCase();
  let role: Role = "ADMIN";
  let trainerId: string | undefined;

  if (lower.startsWith("owner")) {
    role = "OWNER";
  } else if (lower.includes("trainer")) {
    role = "TRAINER";
    trainerId = "trn_004";
  }

  const local = lower.split("@")[0] ?? "user";
  const friendly =
    NAME_BY_EMAIL[Object.keys(NAME_BY_EMAIL).find((k) => local.startsWith(k)) ?? ""] ??
    local
      .split(/[._-]/)
      .filter(Boolean)
      .map((p) => p[0]!.toUpperCase() + p.slice(1))
      .join(" ");

  return {
    id: role === "TRAINER" ? "usr_trn_004" : role === "OWNER" ? "usr_owner" : "usr_admin",
    name: friendly || "Academy User",
    email,
    role,
    trainerId,
    title: role === "TRAINER" ? "Electrical & Fleet Safety Assessor" : "Academy Administrator",
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      pendingEmail: null,
      mfaVerifiedFor: null,
      login: (email) => {
        const user = buildUser(email);
        set({ currentUser: user, pendingEmail: email, mfaVerifiedFor: null });
        return user;
      },
      logout: () => set({ currentUser: null, pendingEmail: null, mfaVerifiedFor: null }),
      setPendingEmail: (email) => set({ pendingEmail: email }),
      verifyMfa: () => {
        const email = get().pendingEmail ?? get().currentUser?.email;
        if (email) set({ mfaVerifiedFor: email });
      },
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
