import { apiOk } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/auth/me
 *
 * Returns the session behind the request cookie. Always 200 — an absent session
 * is `user: null`, not an error, so the client can hydrate without branching on
 * status codes. The password hash and TOTP secret are never included.
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return apiOk({ user: null, mfaPassed: false });
  }

  return apiOk({
    user: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      name: session.user.name || session.user.email.split("@")[0],
      totpEnabled: session.user.totpEnabled,
      /**
       * `User` has no `trainerId` column: a trainer's identity *is* their user id,
       * which is what `Course.trainerId` and `authorize()` both compare against.
       *
       * Exposing it here matters for more than convenience — client-side course
       * scoping reads `currentUser.trainerId`, so leaving it undefined silently
       * widened a trainer's visible courses to all of them. The server still
       * enforces the real rule via `authorize(..., { trainerId })`; this only keeps
       * the UI from asking for rows it will be refused.
       */
      trainerId: session.user.role === "TRAINER" ? session.user.id : undefined,
    },
    mfaPassed: session.mfaPassed,
  });
}
