/**
 * Email templates.
 *
 * Inline CSS only, no web fonts: mail clients strip <style> blocks and a
 * blocked image in an exam access email means the trainee never receives the
 * code. The only remote asset is the academy logo, served from the app origin
 * and given explicit dimensions so a blocked image leaves the layout intact.
 */

import { appUrl, sendEmail } from "@/lib/email/send";
import { ACADEMY, isPlaceholder } from "@/lib/academy/constants";

const NAVY = "#0F2340";
const ORANGE = "#E8590C";
const INK = "#1B2430";
const INK_2 = "#5A6675";
const PAPER = "#F4F2EC";
const LINE = "#E3E0D8";

/**
 * How long a sign-in code stays valid. Exported because the same number has to
 * agree in three places: the row written by /api/auth/login, the resend that
 * replaces it, and the sentence inside the mail itself.
 */
export const OTP_EXPIRY_MINUTES = 10;

interface ShellOptions {
  /** One-line summary shown in the inbox preview before the mail is opened. */
  preheader?: string;
  /** Footer strip under the body. Defaults to the exam-request notice. */
  footer?: string;
}

const DEFAULT_FOOTER = `${ACADEMY.name} &middot; This message was sent because an exam was requested for your enrolment. If you were not expecting it, you can ignore it.`;

/** Brand line for mails that are not exam-related. */
const BRAND_FOOTER = isPlaceholder(ACADEMY.website)
  ? ACADEMY.name
  : `${ACADEMY.name} &middot; ${ACADEMY.website}`;

function shell(inner: string, options: ShellOptions = {}): string {
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;opacity:0;">${options.preheader}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kigali Safety Academy</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid ${LINE};overflow:hidden;">
<tr><td style="background:${NAVY};padding:22px 28px;text-align:center;">
<img src="${escapeHtml(appUrl("/logo.png"))}" alt="Kigali Safety Academy" width="120" height="120" style="display:block;width:120px;height:120px;object-fit:contain;margin:0 auto;border:0;" />
<p style="margin:12px 0 0;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#F2A65A;">Kigali Safety Academy</p>
</td></tr>
<tr><td style="padding:28px;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:${INK};">
${inner}
</td></tr>
<tr><td style="background:${PAPER};padding:16px 28px;border-top:1px solid ${LINE};">
<p style="margin:0;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;font-size:11px;color:${INK_2};">
${options.footer ?? DEFAULT_FOOTER}
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** "4 8 2 9 1 3" — spaced so it is readable over the phone. */
export function spacedOtp(otp: string): string {
  return otp.split("").join(" ");
}

export interface ExamLinkEmailInput {
  traineeName: string;
  courseName: string;
  examUrl: string;
  otp: string;
  expiryMin: number;
  durationMin?: number;
}

export function examLinkEmail(input: ExamLinkEmailInput): { subject: string; html: string; text: string } {
  const subject = "Your Kigali Safety Academy exam access";

  const inner = `
<p style="margin:0 0 6px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:${INK_2};">Exam access</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${NAVY};">Hello ${escapeHtml(input.traineeName)},</h1>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border-radius:10px;border-left:4px solid ${ORANGE};padding:14px 16px;margin:0 0 22px;">
<tr><td>
<p style="margin:0 0 3px;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:${INK_2};">Course</p>
<p style="margin:0;font-size:16px;font-weight:bold;color:${NAVY};">${escapeHtml(input.courseName)}</p>
</td></tr>
</table>

<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${INK};">
Open the link below, then enter this six-digit code to start. The code proves the paper belongs to you, so we are not putting it in the link itself.
</p>

<p style="margin:0 0 6px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:${INK_2};">Your access code</p>
<p style="margin:0 0 6px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:8px;color:${NAVY};">${escapeHtml(spacedOtp(input.otp))}</p>
<p style="margin:0 0 22px;font-size:14px;color:${INK_2};">This code expires in ${input.expiryMin} minutes.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
<tr><td style="background:${ORANGE};border-radius:10px;">
<a href="${escapeHtml(input.examUrl)}" style="display:inline-block;padding:15px 34px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">Start exam</a>
</td></tr>
</table>

<p style="margin:0 0 8px;font-size:13px;color:${INK_2};">Or paste this address into your browser:</p>
<p style="margin:0 0 20px;font-family:'Courier New',Courier,monospace;font-size:12px;word-break:break-all;color:${NAVY};">${escapeHtml(input.examUrl)}</p>

<p style="margin:0;font-size:13px;line-height:1.6;color:${INK_2};">
${input.durationMin ? `Once you enter the code the timer starts and you have ${input.durationMin} minutes. ` : ""}If the code does not arrive, use the &ldquo;Resend code&rdquo; link on the page.
</p>`;

  const text = [
    `Hello ${input.traineeName},`,
    ``,
    `Your exam access for: ${input.courseName}`,
    ``,
    `Your code: ${input.otp}`,
    `This code expires in ${input.expiryMin} minutes.`,
    ``,
    `Start exam: ${input.examUrl}`,
  ].join("\n");

  return { subject, html: shell(inner), text };
}

export interface OtpResentEmailInput {
  traineeName: string;
  courseName: string;
  examUrl: string;
  otp: string;
  expiryMin: number;
}

export function otpResentEmail(input: OtpResentEmailInput) {
  const built = examLinkEmail(input);
  return {
    ...built,
    subject: "Your new Kigali Safety Academy exam code",
    html: built.html.replace(
      "Open the link below, then enter this six-digit code to start.",
      "You asked for a new code. The previous one no longer works.",
    ),
  };
}

export interface CertificateEmailInput {
  traineeName: string;
  courseName: string;
  studentNumber: number;
  verifyUrl: string;
  issuedAt: Date;
}

export function certificateEmail(input: CertificateEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const date = formatDdMmYyyy(input.issuedAt);

  const inner = `
<p style="margin:0 0 6px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:${INK_2};">Certificate issued</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${NAVY};">Congratulations, ${escapeHtml(input.traineeName)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${INK};">
You passed <strong style="color:${NAVY};">${escapeHtml(input.courseName)}</strong>. Your certificate is ready and can be verified publicly by anyone with this link.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border-radius:10px;border-left:4px solid ${ORANGE};padding:14px 16px;margin:0 0 22px;">
<tr><td>
<p style="margin:0 0 8px;font-size:12px;color:${INK_2};">Student number <strong style="color:${NAVY};font-size:18px;">${input.studentNumber}</strong></p>
<p style="margin:0;font-size:12px;color:${INK_2};">Issued <strong style="color:${NAVY};">${date}</strong></p>
</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
<tr><td style="background:${ORANGE};border-radius:10px;">
<a href="${escapeHtml(input.verifyUrl)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">View certificate</a>
</td></tr>
</table>
<p style="margin:0;font-size:12px;word-break:break-all;color:${INK_2};">${escapeHtml(input.verifyUrl)}</p>`;

  const text = [
    `Congratulations ${input.traineeName},`,
    ``,
    `You passed: ${input.courseName}`,
    `Student number: ${input.studentNumber}`,
    `Issued: ${date}`,
    ``,
    `Verify: ${input.verifyUrl}`,
  ].join("\n");

  return { subject: "Your Kigali Safety Academy certificate", html: shell(inner), text };
}

export interface LoginOtpEmailInput {
  /** The six digits, in the clear — this is the one place they exist. */
  code: string;
  expiryMinutes: number;
  /**
   * Where the code is going. Accepted here so the sender and the template can
   * never disagree about the recipient, but deliberately not rendered: the mail
   * already sits in that person's inbox, so printing the address back is pure
   * risk with no benefit.
   */
  recipientEmail: string;
}

/** Subject, HTML and plain text for the sign-in code mail. */
export function loginOtpEmail(input: LoginOtpEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your Kigali Safety Academy sign-in code";
  const preheader = `Your sign-in code is ${input.code} — expires in ${input.expiryMinutes} minutes`;

  const inner = `
<p style="margin:0 0 6px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:${INK_2};">Sign-in code</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:${NAVY};">Sign in to Kigali Safety Academy</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${INK};">
Enter this code on the sign-in page to finish signing in.
</p>

<div style="margin:0 0 8px;text-align:center;font-size:36px;letter-spacing:12px;font-family:'Courier New',Courier,monospace;font-weight:700;color:${NAVY};">${escapeHtml(input.code)}</div>

<p style="margin:22px 0 6px;font-size:14px;color:${INK_2};">This code expires in ${input.expiryMinutes} minutes.</p>
<p style="margin:0;font-size:14px;color:${INK_2};">If you didn&rsquo;t request this, ignore this email.</p>`;

  const text = [
    `Your Kigali Safety Academy sign-in code is: ${input.code}`,
    `Expires in ${input.expiryMinutes} minutes.`,
    `If you didn't request this, ignore this email.`,
  ].join("\n");

  return {
    subject,
    html: shell(inner, {
      preheader,
      footer: BRAND_FOOTER,
    }),
    text,
  };
}

/**
 * Mails a sign-in code and throws when Resend does not accept it.
 *
 * Throws rather than returning a status because a code that was not sent must
 * not be treated as one that was: the login endpoint deletes the row and
 * answers 500, so there is never a code sitting in the database that nobody
 * received. The error message carries Resend's status only — `sendEmail` never
 * returns the payload, so nothing thrown here can contain the code.
 */
export async function sendLoginOtpEmail(input: LoginOtpEmailInput): Promise<void> {
  const message = loginOtpEmail(input);

  const result = await sendEmail({
    to: input.recipientEmail,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (!result.ok) {
    throw new Error(`Resend did not accept the sign-in code email (${result.reason ?? "unknown reason"})`);
  }
}

/** Escape untrusted values before they go into an attribute or text node. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDdMmYyyy(date: Date): string {
  const d = Number.isNaN(date.getTime()) ? new Date() : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export interface OtpCodeOnlyEmailInput {
  traineeName: string;
  courseName: string;
  otp: string;
  expiryMin: number;
}

/**
 * A fresh code with no link, for a trainee who is already part-way through a
 * paper. Staff cannot rebuild the original exam link (only its hash is stored),
 * so this tells them to reuse the link they already have.
 */
export function otpCodeOnlyEmail(input: OtpCodeOnlyEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your new Kigali Safety Academy exam code";

  const inner = `
<p style="margin:0 0 6px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:${INK_2};">Exam access</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${NAVY};">Hello ${escapeHtml(input.traineeName)},</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};">
The academy has reopened your exam for <strong>${escapeHtml(input.courseName)}</strong>. Open the exam link you were sent earlier and enter this new six-digit code. The time already used on your paper still counts.
</p>
<p style="margin:0 0 6px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:${INK_2};">Your access code</p>
<p style="margin:0 0 6px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:8px;color:${NAVY};">${escapeHtml(spacedOtp(input.otp))}</p>
<p style="margin:0;font-size:14px;color:${INK_2};">This code expires in ${input.expiryMin} minutes.</p>`;

  const text = [
    `Hello ${input.traineeName},`,
    ``,
    `The academy has reopened your exam for ${input.courseName}.`,
    `Open the exam link you were sent earlier and enter this code: ${input.otp}`,
    `This code expires in ${input.expiryMin} minutes. The time already used on your paper still counts.`,
  ].join("\n");

  return { subject, html: shell(inner), text };
}
