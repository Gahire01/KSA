import type { Role } from "@/lib/types";

/**
 * The single authorisation gate for Phase 1. Every API route calls this rather
 * than checking roles inline, so the rules live in one place.
 *
 * Phase 1 is owner-only: only the seeded owner may read or write academy data.
 */
export type AuthzAction =
  | "trainee.read"
  | "trainee.create"
  | "trainee.update"
  | "trainee.delete"
  | "course.read"
  | "course.create"
  | "course.update"
  | "course.delete"
  | "category.read"
  | "category.create";

export type AuthzResource = {
  /** Owner of the row, where the model tracks one. Not set in Phase 1. */
  ownerId?: string | null;
};

export interface AuthzSubject {
  id: string;
  role: Role;
  isActive?: boolean;
}

export type AuthzDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

const WRITE_ACTIONS: ReadonlySet<AuthzAction> = new Set<AuthzAction>([
  "trainee.create",
  "trainee.update",
  "trainee.delete",
  "course.create",
  "course.update",
  "course.delete",
  "category.create",
]);

export function isWriteAction(action: AuthzAction): boolean {
  return WRITE_ACTIONS.has(action);
}

/**
 * Phase 1 authorises exactly one role.
 *
 * ADMIN and TRAINER accounts cannot be created yet — there is no invite flow —
 * so granting them read access would advertise a capability that does not
 * exist. Deny, and relax this when those roles become real.
 */
export function authorize(
  user: AuthzSubject | null | undefined,
  action: AuthzAction,
  resource?: AuthzResource,
): AuthzDecision {
  /* Kept in the signature so the gate can become resource-aware in Phase 2. */
  void action;
  void resource;

  if (!user) {
    return { ok: false, status: 401, error: "Sign in to continue." };
  }

  if (user.isActive === false) {
    return { ok: false, status: 403, error: "This account has been deactivated." };
  }

  if (user.role !== "OWNER") {
    return {
      ok: false,
      status: 403,
      error: "Only the academy owner can use this system during Phase 1.",
    };
  }

  return { ok: true };
}