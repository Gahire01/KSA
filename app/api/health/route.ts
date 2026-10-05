import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness plus a real database round-trip.
 * Reports 503 when the database is unreachable so a monitor can alert on it.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "ok" }, { status: 200 });
  } catch (error) {
    /* The driver message can name the host, the schema and the failing
     * statement, so it goes to the server log and not to an unauthenticated
     * caller. This route has no session to correlate with, hence no request id. */
    console.error("[health] database round-trip failed:", error);

    return NextResponse.json({ ok: false, db: "error" }, { status: 503 });
  }
}
