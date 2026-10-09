/**
 * Resend transport.
 *
 * Thin on purpose: one function that posts to the API and never throws into the
 * caller's control flow. A failed email must roll back the attempt it belongs
 * to, but it must not surface as a 500 with a provider message attached — see
 * lib/email/send.ts, which owns that policy.
 */

import { TEXT_FOOTER } from "@/lib/email/footer";

/* Overridable so a test run can point at a local capture server instead of sending real mail. */
const RESEND_ENDPOINT = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

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
}

/**
 * Where a reply lands: EMAIL_REPLY_TO if set, otherwise the owner's own address, so a
 * trainee who answers a mail reaches a person instead of a dead no-reply box. Looked up
 * once per process; a failed lookup just means no Reply-To header, never a failed send.
 */
let replyToPromise: Promise<string | null> | undefined;

function replyToAddress(): Promise<string | null> {
  if (process.env.EMAIL_REPLY_TO?.trim()) return Promise.resolve(process.env.EMAIL_REPLY_TO.trim());
  replyToPromise ??= import("@/lib/db")
    .then(({ prisma }) => prisma.user.findFirst({ where: { role: "OWNER", isActive: true }, select: { email: true } }))
    .then((owner) => owner?.email ?? null)
    .catch(() => null);
  return replyToPromise;
}

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  /* EMAIL_FROM is the single switch for the sender identity. Until the KSA
   * domain is verified in Resend it is unset or points at the sandbox
   * onboarding address, so the fallback keeps mail flowing either way. */
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  if (!apiKey) {
    return { ok: false, reason: "RESEND_API_KEY is not configured" };
  }

  if (!from) {
    return { ok: false, reason: "EMAIL_FROM is not configured" };
  }

  try {
    const replyTo = await replyToAddress();
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: input.subject,
        /* HTML plus a plain-text alternative: mail with only HTML scores worse with spam filters. */
        html: input.html,
        text: `${input.text}${TEXT_FOOTER}`,
      }),
      /* Email must not hold up the request that triggered it. */
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      /* Status only — the body can echo back the message content. */
      return { ok: false, reason: `Resend responded ${response.status}` };
    }

    const body = (await response.json()) as { id?: string };
    return { ok: true, id: body.id };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown transport error",
    };
  }
}

export function appUrl(path = ""): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${path}`;
}