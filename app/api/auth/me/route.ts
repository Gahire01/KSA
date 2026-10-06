import { apiFail, apiOk } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/auth/me
 *
 * The identity behind the request cookie: 401 when there is none, expired or
 * belongs to a deactivated account, and `{ id, email, role, name }` when there
 * is. The password hash, TOTP secret and session id never appear here.
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return apiFail("Sign in to continue.", 401);
  }

  return apiOk({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    name: session.user.name || session.user.email.split("@")[0],
  });
}
