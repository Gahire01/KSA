import { after } from "next/server";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import {
  examStartedEmail,
  examSubmittedEmail,
  type ExamStartedEmailInput,
  type ExamSubmittedEmailInput,
} from "@/lib/email/templates";

/**
 * Plain emails to the academy owner(s) when a sitting starts and when it is graded.
 *
 * They run after the response has gone out, so a slow SMTP handshake can never delay
 * a trainee's code check or submit, and they never throw: a failed alert must not
 * undo an exam action. Owners who switched email notifications off are skipped.
 */

async function ownerEmails(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { role: "OWNER", isActive: true, emailNotifications: true },
    select: { email: true },
  });
  return rows.map((r) => r.email);
}

async function sendToOwners(message: { subject: string; html: string; text: string }): Promise<void> {
  try {
    for (const to of await ownerEmails()) {
      const sent = await sendEmail({ to, ...message });
      if (!sent.ok) console.error(`[exam-alerts] email not sent: ${sent.reason ?? "unknown reason"}`);
    }
  } catch (error) {
    console.error("[exam-alerts] failed", error);
  }
}

/** `after` only exists inside a request; anywhere else just run it. */
function defer(work: () => Promise<void>): void {
  try {
    after(work);
  } catch {
    void work();
  }
}

export function notifyOwnersExamStarted(input: ExamStartedEmailInput): void {
  defer(() => sendToOwners(examStartedEmail(input)));
}

export function notifyOwnersExamSubmitted(input: ExamSubmittedEmailInput): void {
  defer(() => sendToOwners(examSubmittedEmail(input)));
}
