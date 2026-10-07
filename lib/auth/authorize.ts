import type { Role } from "@/lib/types";

/**
 * The single authorisation gate. Every API route calls this rather than
 * checking roles inline, so the rules live in one place.
 *
 * Roles:
 *  - OWNER   the academy owner. Password + TOTP. Full control, including
 *            minting and revoking access links and devices.
 *  - ADMIN   day-to-day operations: trainees, exams, certificates, reporting.
 *  - TRAINER  assigned courses only. Sees their own cohorts, not the money.
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
  | "category.create"
  | "question.read"
  | "question.write"
  | "exam.read"
  | "exam.send"
  | "exam.grade"
  | "exam.grant"
  | "certificate.read"
  | "certificate.issue"
  | "certificate.revoke"
  | "notification.read"
  | "device.self"
  | "access.manage"
  | "signature.manage"
  | "device.manage"
  | "audit.read"
  | "report.read";

export type AuthzResource = {
  /** Owner of the row, where the model tracks one. */
  ownerId?: string | null;
  /**
   * Trainer assigned to the resource's course. TRAINER may act only when this
   * matches their own user id.
   */
  trainerId?: string | null;
};

export interface AuthzSubject {
  id: string;
  role: Role;
  isActive?: boolean;
}

export type AuthzDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

const ALL_ROLES: ReadonlySet<Role> = new Set<Role>(["OWNER", "ADMIN", "TRAINER"]);
const STAFF_ROLES: ReadonlySet<Role> = new Set<Role>(["OWNER", "ADMIN"]);
const TRAINER_SCOPED: ReadonlySet<Role> = new Set<Role>(["TRAINER"]);

/**
 * Which roles may perform each action.
 *
 * A missing entry denies every role, so a newly added action is closed until it
 * is deliberately opened here.
 */
const GRANTS: Readonly<Record<AuthzAction, ReadonlySet<Role>>> = {
  "trainee.read": ALL_ROLES,
  "trainee.create": STAFF_ROLES,
  "trainee.update": STAFF_ROLES,
  "trainee.delete": new Set<Role>(["OWNER"]),

  "course.read": ALL_ROLES,
  "course.create": STAFF_ROLES,
  "course.update": STAFF_ROLES,
  "course.delete": new Set<Role>(["OWNER"]),

  "category.read": ALL_ROLES,
  "category.create": STAFF_ROLES,

  /* The question bank returns the answer key (`isCorrect`) so staff can set the
   * paper, so trainers are excluded from the grant itself rather than relying on
   * the missing-resource trap. */
  "question.read": STAFF_ROLES,
  "question.write": STAFF_ROLES,

  "exam.read": ALL_ROLES,
  "exam.send": STAFF_ROLES,
  "exam.grade": STAFF_ROLES,
  /* Granting an attempt beyond the course limit is an owner decision. */
  "exam.grant": new Set<Role>(["OWNER"]),

  "certificate.read": ALL_ROLES,
  "certificate.issue": STAFF_ROLES,
  "certificate.revoke": new Set<Role>(["OWNER"]),

  "notification.read": ALL_ROLES,

  /* Listing and revoking your own devices — scoped by `session.user.id` in the
   * route, so no course resource exists to name. Distinct from `device.manage`,
   * which is the owner acting on somebody else's device. */
  "device.self": ALL_ROLES,

  /* Minting a way in is the most privileged action in the product. */
  "access.manage": new Set<Role>(["OWNER"]),
  /* Drawing, uploading and locking the certificate signature. Owner only. */
  "signature.manage": new Set<Role>(["OWNER"]),
  "device.manage": new Set<Role>(["OWNER"]),
  "audit.read": new Set<Role>(["OWNER"]),
  "report.read": STAFF_ROLES,
};

export function isWriteAction(action: AuthzAction): boolean {
  return GRANTS[action] ? !GRANTS[action].has("TRAINER") && !GRANTS[action].has("ADMIN") : true;
}

/**
 * Actions a TRAINER may perform without a resource, because they can only ever
 * touch rows already scoped to the caller by `session.user.id`.
 *
 * `notification.read` is the case that matters: a trainer reading their own
 * notifications has no course to name, so requiring one would deny them the
 * feature entirely. A missing entry still requires a resource, so this list stays
 * closed by default — a new self-scoped action has to be added deliberately.
 */
const SELF_SCOPED: ReadonlySet<AuthzAction> = new Set<AuthzAction>([
  "notification.read",
  "device.self",
]);

/**
 * Decides whether `user` may perform `action` on `resource`.
 *
 * TRAINER is the only role that needs the resource: they may act only on rows
 * whose course is assigned to them, and are denied outright where the row has
 * no trainer (an unassigned course belongs to the owner and admin staff).
 */
export function authorize(
  user: AuthzSubject | null | undefined,
  action: AuthzAction,
  resource?: AuthzResource,
): AuthzDecision {
  if (!user) {
    return { ok: false, status: 401, error: "Sign in to continue." };
  }

  if (user.isActive === false) {
    return { ok: false, status: 403, error: "This account has been deactivated." };
  }

  const allowed = GRANTS[action];

  if (!allowed || !allowed.has(user.role)) {
    return {
      ok: false,
      status: 403,
      error: "You do not have permission to do that.",
    };
  }

  if (TRAINER_SCOPED.has(user.role) && !SELF_SCOPED.has(action)) {
    if (!resource) {
      return {
        ok: false,
        status: 403,
        error: "Trainers can only work on the courses assigned to them.",
      };
    }

    if (resource.ownerId !== undefined && resource.ownerId !== null && resource.ownerId !== user.id) {
      return { ok: false, status: 403, error: "That record is not yours." };
    }

    if (resource.trainerId !== user.id) {
      return {
        ok: false,
        status: 403,
        error: "Trainers can only work on the courses assigned to them.",
      };
    }
  }

  return { ok: true };
}

/** Convenience for routes that simply need "is this staff, any kind". */
export function isStaff(role: Role | undefined | null): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "TRAINER";
}