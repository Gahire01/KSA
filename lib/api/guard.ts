import { apiFail } from "@/lib/api/response";
import { authorize, type AuthzAction } from "@/lib/auth/authorize";
import { getSession } from "@/lib/auth/session";

export type GuardResult =
  | {
      ok: true;
      session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
      /**
       * Set only for a TRAINER: their own user id. A route that opted in with
       * `{ trainerScoped: true }` MUST narrow its query to courses whose `trainerId`
       * equals this (see lib/auth/scope.ts), because the guard let the request through
       * on the strength of that promise. `null` means unrestricted (owner, admin).
       */
      trainerScope: string | null;
    }
  | { ok: false; response: ReturnType<typeof apiFail> };

export interface GuardOptions {
  /**
   * The route applies row-level scoping for trainers (a WHERE on the course's
   * trainer, or an ownership check on the record it loads). Without this flag a
   * TRAINER is refused on every action that is not self-scoped, so forgetting it
   * fails closed.
   */
  trainerScoped?: boolean;
}

/**
 * Session + role gate for API routes.
 *
 * Every route that touches real data goes through here. There is no second
 * factor to wait for any more: sign-in is email OTP, and a session is only ever
 * minted once that code has been redeemed (lib/auth/session.ts). `Session.mfa`
 * columns are retained for a possible TOTP return, but nothing branches on them.
 */
export async function guard(action: AuthzAction, options: GuardOptions = {}): Promise<GuardResult> {
  const session = await getSession();

  if (!session) {
    return { ok: false, response: apiFail("Sign in to continue.", 401) };
  }

  const isTrainer = session.user.role === "TRAINER";

  /* A session from a shared link or code runs as a user that other holders share (every
   * holder of a trainer link IS that trainer). Managing "my devices" or "my sessions" there
   * would let one holder see and remove the others, so the owner is the only one who can. */
  if (action === "device.self" && (session.accessLinkId || session.referralCodeId)) {
    return {
      ok: false,
      response: apiFail("Devices on a shared link are managed by the academy owner.", 403),
    };
  }

  const decision = authorize(
    {
      id: session.user.id,
      role: session.user.role,
      isActive: session.user.isActive,
    },
    action,
    /* A scoped route has promised to filter by trainer, so the trainer is admitted
     * against themselves; the route then narrows every query. */
    options.trainerScoped && isTrainer ? { trainerId: session.user.id } : undefined,
  );

  if (!decision.ok) {
    return { ok: false, response: apiFail(decision.error, decision.status) };
  }

  return { ok: true, session, trainerScope: isTrainer ? session.user.id : null };
}

/** Gate for the MFA endpoints themselves, which run before mfaPassed is set. */
export async function guardPendingSession(): Promise<GuardResult> {
  const session = await getSession();

  if (!session) {
    return { ok: false, response: apiFail("Sign in to continue.", 401) };
  }

  return { ok: true, session, trainerScope: null };
}
