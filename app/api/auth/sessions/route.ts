import { guard } from "@/lib/api/guard";
import { apiOk } from "@/lib/api/response";
import { listSessions } from "@/lib/auth/session";
import { lookupLocation } from "@/lib/utils/geo";
import { parseUserAgent } from "@/lib/utils/ua";

/**
 * GET /api/auth/sessions — every live session on the signed-in account.
 *
 * Hard-scoped to `session.user.id`, so there is no id parameter to tamper with
 * and one user can never enumerate another's sessions. The returned id is the
 * stored HMAC of the cookie token, which is not the token itself: knowing it
 * lets the caller revoke that row and nothing else.
 *
 * Location is a best-effort, timeout-bounded lookup performed here on the
 * server, so a slow geo service costs one slow call rather than a blocked page.
 */
export async function GET() {
  const gate = await guard("device.self");
  if (!gate.ok) return gate.response;

  const rows = await listSessions(gate.session.user.id);

  const items = await Promise.all(
    rows.map(async (row) => {
      const agent = parseUserAgent(row.userAgent);
      const lastSeenAt = row.lastSeenAt ?? row.createdAt;

      return {
        id: row.id,
        device: agent.device,
        browser: agent.browser,
        os: agent.os,
        ip: row.ip,
        location: await lookupLocation(row.ip),
        lastSeenAt: lastSeenAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        current: row.id === gate.session.id,
      };
    }),
  );

  return apiOk({ items });
}
