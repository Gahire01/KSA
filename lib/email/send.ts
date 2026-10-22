import nodemailer from "nodemailer";
import { TEXT_FOOTER } from "@/lib/email/footer";

export { appUrl } from "@/lib/app-url";

export interface SendResult {
  ok: boolean;
  /** Provider message id on success. */
  id?: string;
  /** Safe-to-log reason on failure. Never contains the OTP. */
  reason?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: "application/pdf" }>;
}

let transport: ReturnType<typeof nodemailer.createTransport> | undefined;

/** Preserve the result contract so callers can roll back unsent OTPs. */
export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return { ok: false, reason: "GMAIL_USER and GMAIL_APP_PASSWORD must be configured" };
  }

  try {
    transport ??= nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const result = await transport.sendMail({
      from: `"Kigali Safety Academy" <${user}>`,
      replyTo: user,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: `${input.text}${TEXT_FOOTER}`,
      attachments: input.attachments,
    });
    if (!result.accepted?.length || result.rejected?.length) {
      return { ok: false, reason: "Gmail SMTP did not accept the recipient" };
    }
    return { ok: true, id: result.messageId };
  } catch (error) {
    // SMTP error messages can contain addresses or authentication details.
    const code = (error as { code?: string } | null)?.code;
    const reason = code === "EAUTH"
      ? "Gmail SMTP authentication failed"
      : code === "ETIMEDOUT"
        ? "Gmail SMTP connection timed out"
        : "Gmail SMTP delivery failed";
    return { ok: false, reason };
  }
}
