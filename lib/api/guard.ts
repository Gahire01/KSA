import { apiFail } from "@/lib/api/response";
import { authorize, type AuthzAction } from "@/lib/auth/authorize";
import { getSession } from "@/lib/auth/session";

export type GuardResult =
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
  | { ok: false; response: ReturnType<typeof apiFail> };

/**
 * Session + role + MFA gate for API routes.
 *
 * Every route that touches real data goes through here. `requireMfa` defaults to
 * true: a password alone must not be enough to read or write academy data.
 */
export async function guard(
  action: AuthzAction,
  options: { requireMfa?: boolean } = {},
): Promise<GuardResult> {
  const { requireMfa = true } = options;
  const session = await getSession();

  if (!session) {
    return { ok: false, response: apiFail("Sign in to continue.", 401) };
  }

  const decision = authorize(
    {
      id: session.user.id,
      role: session.user.role,
      isActive: session.user.isActive,
    },
    action,
  );

  if (!decision.ok) {
    return { ok: false, response: apiFail(decision.error, decision.status) };
  }

  if (requireMfa && !session.mfaPassed) {
    return { ok: false, response: apiFail("Second factor required.", 403) };
  }

  return { ok: true, session };
}

/** Gate for the MFA endpoints themselves, which run before mfaPassed is set. */
export async function guardPendingSession(): Promise<GuardResult> {
  const session = await getSession();

  if (!session) {
    return { ok: false, response: apiFail("Sign in to continue.", 401) };
  }

  return { ok: true, session };
}
