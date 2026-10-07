import { timingSafeEqual } from "node:crypto";

import { apiFail, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/db";

/**
 * GET /api/cron/cleanup — nightly housekeeping (scheduled in vercel.json).
 *
 * Deletes rows that can no longer be used: expired sessions, expired or spent
 * sign-in codes, and exam codes' leftovers are left alone (they belong to attempts).
 * Never touches the audit log, which is append-only.
 *
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. With no
 * CRON_SECRET configured the route refuses everything, so an unconfigured deploy
 * exposes no public endpoint that deletes data.
 */
export const dynamic = "force-dynamic";

function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !header) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return apiFail("Cleanup is not configured.", 503);
  if (!authorised(request.headers.get("authorization"))) return apiFail("Not authorised.", 401);

  const now = new Date();

  try {
    const [sessions, loginOtps] = await Promise.all([
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.loginOtp.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);

    return apiOk({ sessionsDeleted: sessions.count, loginOtpsDeleted: loginOtps.count });
  } catch (error) {
    return apiFail("Cleanup failed.", 500, { logError: error });
  }
}
