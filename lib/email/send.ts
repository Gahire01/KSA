/**
 * Resend transport.
 *
 * Thin on purpose: one function that posts to the API and never throws into the
 * caller's control flow. A failed email must roll back the attempt it belongs
 * to, but it must not surface as a 500 with a provider message attached — see
 * lib/email/send.ts, which owns that policy.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

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

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) {
    return { ok: false, reason: "RESEND_API_KEY is not configured" };
  }

  if (!from) {
    return { ok: false, reason: "EMAIL_FROM is not configured" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
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