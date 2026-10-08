import { timingSafeEqual } from "node:crypto";

import { apiFail, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { emit, ownerAndTrainerIds, ownerIds } from "@/lib/notifications/emit";

/**
 * GET /api/cron/cleanup — nightly housekeeping (scheduled in vercel.json), plus the
 * `deadline.approaching` notifications.
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

const DAY_MS = 24 * 60 * 60 * 1000;
/** Trainees whose deadline is this many days away are flagged. */
const DEADLINE_WARNING_DAYS = 3;

/**
 * `deadline.approaching`: one notification per trainee, three days out.
 *
 * The cron runs once a day, so the window is exactly one day wide, (now + 2d,
 * now + 3d]: every trainee falls inside it on exactly one run and nothing needs a
 * "sent already" marker. Finished or withdrawn enrolments are skipped.
 */
async function notifyApproachingDeadlines(now: Date): Promise<number> {
  const from = new Date(now.getTime() + (DEADLINE_WARNING_DAYS - 1) * DAY_MS);
  const to = new Date(now.getTime() + DEADLINE_WARNING_DAYS * DAY_MS);

  const trainees = await prisma.trainee.findMany({
    where: {
      deadlineAt: { gt: from, lte: to },
      status: { in: ["PENDING", "ACTIVE"] },
    },
    select: { id: true, fullName: true, courseId: true, course: { select: { name: true } } },
    take: 500,
  });

  for (const trainee of trainees) {
    const recipients = trainee.courseId ? await ownerAndTrainerIds(trainee.courseId) : await ownerIds();
    await emit("deadline.approaching", {
      recipients: recipients.map((userId) => ({ userId })),
      title: "Deadline approaching",
      link: `/trainees/${trainee.id}`,
      body: `${trainee.fullName}'s deadline${trainee.course ? ` for ${trainee.course.name}` : ""} is in ${DEADLINE_WARNING_DAYS} days.`,
    });
  }
  return trainees.length;
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

    const deadlinesNotified = await notifyApproachingDeadlines(now);

    return apiOk({
      sessionsDeleted: sessions.count,
      loginOtpsDeleted: loginOtps.count,
      deadlinesNotified,
    });
  } catch (error) {
    return apiFail("Cleanup failed.", 500, { logError: error });
  }
}
