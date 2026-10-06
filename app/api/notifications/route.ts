import { z } from "zod";

import { apiOk } from "@/lib/api/response";
import { guard } from "@/lib/api/guard";
import { prisma } from "@/lib/db";
import type { AppNotification, NotificationType } from "@/lib/types";

/**
 * GET /api/notifications — the signed-in user's own notifications.
 *
 * Scoped by `session.user.id` rather than by any query parameter, so there is no
 * path from a request body to somebody else's rows. `POST` marks one or all read
 * under the same scope.
 *
 * `type` is stored as a plain string by `emit()`, so it is checked against the
 * known union here instead of being cast: a value the client has never heard of
 * would otherwise reach a `switch` that silently matches nothing.
 */

const KNOWN_TYPES = new Set<string>([
  "exam.sent",
  "exam.submitted",
  "exam.passed",
  "exam.failed",
  "payment.recorded",
  "trainee.enrolled",
  "deadline.approaching",
  "certificate.expiring",
  "certificate.issued",
  "exam.link.expiring",
  "system",
]);

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(60),
  unreadOnly: z.coerce.boolean().default(false),
});

const readBody = z
  .object({
    /** Omit to mark everything read. */
    id: z.string().trim().min(1).max(60).optional(),
    all: z.boolean().default(false),
  })
  .strict()
  .refine((v) => v.all || Boolean(v.id), {
    message: "Pass an id, or all: true.",
  });

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Maps a row to the client shape.
 *
 * `actorName` and `mention` are always empty/false: the `Notification` table
 * carries no actor, and inventing one would show a name the row does not
 * contain. The bell already renders both as optional.
 */
function toAppNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: (KNOWN_TYPES.has(row.type) ? row.type : "system") as NotificationType,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    read: row.readAt !== null,
    mention: false,
    link: row.link,
    actorName: "",
  };
}

export async function GET(request: Request) {
  const gate = await guard("notification.read");
  if (!gate.ok) return gate.response;

  const parsed = listQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    return apiOk({ items: [], total: 0, unread: 0 });
  }

  const { limit, unreadOnly } = parsed.data;
  const userId = gate.session.user.id;

  const [rows, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return apiOk(
    { items: rows.map(toAppNotification), total, unread },
    200,
    /* Notifications are per-session and change on every write, so a shared cache
     * must not hold yesterday's unread count. */
    { "Cache-Control": "private, no-store" },
  );
}

export async function POST(request: Request) {
  const gate = await guard("notification.read");
  if (!gate.ok) return gate.response;

  const raw: unknown = await request.json().catch(() => null);
  const parsed = readBody.safeParse(raw);

  if (!parsed.success) {
    return apiOk({ updated: 0 });
  }

  const userId = gate.session.user.id;
  const { id, all } = parsed.data;

  /* Both filters carry `userId`, so a guessed id belonging to another account
   * matches nothing rather than marking it read. */
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(all ? {} : { id }),
    },
    data: { readAt: new Date() },
  });

  const unread = await prisma.notification.count({ where: { userId, readAt: null } });

  return apiOk({ updated: result.count, unread });
}
