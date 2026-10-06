import { apiFail } from "@/lib/api/response";
import { authorize, type AuthzAction } from "@/lib/auth/authorize";
import { getSession } from "@/lib/auth/session";

export type GuardResult =
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
  | { ok: false; response: ReturnType<typeof apiFail> };

/**
 * Session + role gate for API routes.
 *
 * Every route that touches real data goes through here. There is no second
 * factor to wait for any more: sign-in is email OTP, and a session is only ever
 * minted once that code has been redeemed (lib/auth/session.ts). `Session.mfa`
 * columns are retained for a possible TOTP return, but nothing branches on them.
 */
export async function guard(action: AuthzAction): Promise<GuardResult> {
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
