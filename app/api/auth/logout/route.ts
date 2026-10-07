import { apiOk } from "@/lib/api/response";
import { audit, actorOf } from "@/lib/audit";
import { destroySession, getSession } from "@/lib/auth/session";

/** POST /api/auth/logout — clears the session row and the cookie. */
export async function POST() {
  /* Read who is signing out BEFORE the row goes, so the log can say. No session is
   * not an error: signing out twice is harmless and still answers ok. */
  const session = await getSession();

  await destroySession();

  if (session) {
    await audit({ ...actorOf(session), action: "auth.logout", entityType: "Session" });
  }

  return apiOk({ signedOut: true });
}
