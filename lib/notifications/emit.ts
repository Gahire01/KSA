import { prisma } from "@/lib/db";
import { publish, type NotificationEvent } from "@/lib/notifications/broadcaster";
import { sendEmail, appUrl } from "@/lib/email/send";

/**
 * Writes a Notification, pushes it down the user's open SSE stream, and queues
 * an email for the types that warrant one.
 *
 * `emit` never throws: a notification failing to insert must not take down the
 * action that produced it (an exam submission, a certificate issuance).
 */

/** Only these types also produce an email, per the client's launch spec. */
const EMAIL_TYPES: ReadonlySet<string> = new Set([
  "exam.failed",
  "certificate.issued",
  "deadline.approaching",
]);

export interface EmitTarget {
  userId: string;
  email?: string | null;
  /** Skip the email even for an email-eligible type. */
  noEmail?: boolean;
}

export interface EmitOptions {
  recipients: EmitTarget[];
  title: string;
  body?: string;
  link?: string | null;
  /** Build a per-recipient body when it differs (e.g. one message per trainee). */
  bodyFor?: (target: EmitTarget) => string;
}

function toEvent(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationEvent {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function emit(type: string, options: EmitOptions): Promise<void> {
  const { recipients } = options;
  const link = options.link ?? null;

  for (const target of recipients) {
    if (!target.userId) continue;

    try {
      const row = await prisma.notification.create({
        data: {
          userId: target.userId,
          type,
          title: options.title,
          body: options.bodyFor ? options.bodyFor(target) : (options.body ?? ""),
          link,
        },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          readAt: true,
          createdAt: true,
        },
      });

      publish(target.userId, toEvent(row));

      if (!EMAIL_TYPES.has(type) || target.noEmail) continue;

      const user = await prisma.user.findUnique({
        where: { id: target.userId },
        select: { emailNotifications: true, email: true },
      });

      if (!user?.emailNotifications) continue;

      const sent = await sendEmail({
        to: target.email ?? user.email,
        subject: `${options.title} - Kigali Safety Academy`,
        html: notificationEmailHtml({
          title: options.title,
          body: row.body,
          link,
        }),
        text: `${options.title}\n\n${row.body}${link ? `\n\n${appUrl(link)}` : ""}`,
      });

      if (sent.ok) {
        await prisma.notification
          .update({ where: { id: row.id }, data: { emailedAt: new Date() } })
          .catch(() => {});
      }
    } catch (error) {
      /* Never let a notification break the action that triggered it. */
      console.error(`[notifications] emit ${type} failed`, error);
    }
  }
}

/** Resolves every OWNER id, the audience for academy-wide events. */
export async function ownerIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { role: "OWNER", isActive: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** OWNER plus the trainer assigned to a course, de-duplicated. */
export async function ownerAndTrainerIds(courseId: string): Promise<string[]> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { trainerId: true },
  });

  const ids = new Set(await ownerIds());
  if (course?.trainerId) ids.add(course.trainerId);
  return [...ids];
}

function notificationEmailHtml(input: {
  title: string;
  body: string;
  link: string | null;
}): string {
  const button = input.link
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:#E8590C;border-radius:10px;">
<a href="${escapeAttr(appUrl(input.link))}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">Open</a>
</td></tr></table>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>${escapeAttr(input.title)}</title></head>
<body style="margin:0;padding:0;background:#F4F2EC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EC;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #E3E0D8;overflow:hidden;">
<tr><td style="background:#0F2340;padding:22px 28px;">
<p style="margin:0;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#F2A65A;">Kigali Safety Academy</p>
</td></tr>
<tr><td style="padding:28px;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#1B2430;">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#5A6675;">Update</p>
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#0F2340;">${escapeAttr(input.title)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1B2430;">${escapeAttr(input.body)}</p>
${button}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}