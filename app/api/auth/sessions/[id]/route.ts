import type { NextRequest } from "next/server";

import { guard } from "@/lib/api/guard";
import { apiFail, apiNotFound, apiOk } from "@/lib/api/response";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/cookies";
import { revokeSessionById } from "@/lib/auth/session";

/**
 * DELETE /api/auth/sessions/[id] — sign one of your own sessions out.
 *
 * Scoped twice: the action must pass the guard, and the delete is filtered by
 * `userId`, so a guessed id belonging to somebody else deletes nothing and
 * answers 404 rather than confirming the id exists.
 *
 * Revoking the session in use clears this browser's cookie too, which is what
 * "sign out" means for the row you are standing on.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await guard("device.self");
  if (!gate.ok) return gate.response;

  const { id } = await params;

  const revoked = await revokeSessionById(gate.session.user.id, id);
  if (!revoked) return apiNotFound("Session");

  if (id === gate.session.id) {
    const token = await readSessionCookie();
    if (token) await clearSessionCookie();
  }

  return apiOk({ revoked: true, wasCurrent: id === gate.session.id });
}

/** Keeps a GET from falling through to Next's default 405 shape. */
export async function GET() {
  return apiFail("Method not allowed.", 405);
}
