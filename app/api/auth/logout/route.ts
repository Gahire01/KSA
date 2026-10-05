import { apiOk } from "@/lib/api/response";
import { destroySession } from "@/lib/auth/session";

/** POST /api/auth/logout — clears the session row and the cookie. */
export async function POST() {
  await destroySession();
  return apiOk({ signedOut: true });
}
