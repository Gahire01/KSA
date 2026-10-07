import { prisma } from "@/lib/db";

/**
 * Writes one audit entry and never throws.
 *
 * The audit log is append-only: nothing in the app updates or deletes a row. A
 * failed write is logged and swallowed rather than allowed to turn an action that
 * already happened into a 500, which would tell the user it failed when it did not
 * (and invite a retry of something that is not idempotent).
 *
 * Never put a secret in `meta`: the log is read by people who should not hold
 * working tokens, codes or passwords.
 */
export async function audit(entry: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        meta: entry.meta ? JSON.stringify(entry.meta) : null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    console.error(`[audit] could not record ${entry.action}`, error);
  }
}

/** The actor fields from a signed-in session, for the common call. */
export function actorOf(session: { user: { id: string; email: string } }) {
  return { actorId: session.user.id, actorEmail: session.user.email };
}
