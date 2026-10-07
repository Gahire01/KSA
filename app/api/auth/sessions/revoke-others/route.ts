import { guard } from "@/lib/api/guard";
import { apiOk } from "@/lib/api/response";
import { actorOf, audit } from "@/lib/audit";
import { revokeOtherSessions } from "@/lib/auth/session";

/**
 * POST /api/auth/sessions/revoke-others — sign out everywhere except here.
 *
 * Deletes the rows rather than revoking devices on purpose: this is "sign out
 * of my other sessions", not "forget my browsers", so the same devices stay
 * remembered and can sign back in with a fresh code.
 */
export async function POST() {
  const gate = await guard("device.self");
  if (!gate.ok) return gate.response;

  const revoked = await revokeOtherSessions(gate.session.user.id, gate.session.id);

  await audit({
    ...actorOf(gate.session),
    action: "auth.session.revoke-others",
    entityType: "Session",
    meta: { revoked },
  });

  return apiOk({ revoked });
}
