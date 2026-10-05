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
      name: session.user.email.split("@")[0],
      totpEnabled: session.user.totpEnabled,
    },
    mfaPassed: session.mfaPassed,
  });
}
