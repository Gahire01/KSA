/**
 * WhatsApp delivery through Twilio, using plain HTTPS (no SDK).
 *
 * Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM. When any
 * is missing everything here reports "not configured" instead of throwing, so
 * the exam send falls back to email and never crashes.
 *
 * Nothing in this file logs a message body, a code or a link: those carry the
 * trainee's OTP. Only phone-number suffixes and Twilio status codes are logged.
 */

export type WhatsappCheck = "yes" | "no" | "unknown" | "invalid";

const LOOKUP_CACHE_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

interface TwilioEnv {
  sid: string;
  token: string;
  from: string;
}

function env(): TwilioEnv | null {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
  if (!sid || !token || !from) return null;
  return { sid, token, from: from.replace(/^whatsapp:/i, "") };
}

export function whatsappConfigured(): boolean {
  return env() !== null;
}

/**
 * Best-effort E.164. A leading + is kept and 250... is accepted. A LOCAL number
 * (07..., no country code) is completed as Rwandan only when the trainee's country
 * says Rwanda: a Ugandan or Congolese local number must not be silently sent to a
 * stranger in Kigali along with an exam code. Anything else is rejected rather than
 * guessed. The all-zero placeholder used for register-seeded trainees is never a
 * real number.
 */
export function normalizeE164(
  raw: string | null | undefined,
  country?: string | null,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || /^0+$/.test(digits.replace(/^250/, ""))) return null;

  const isRwanda = /rwanda/i.test(country ?? "");

  let e164: string;
  if (trimmed.startsWith("+")) e164 = `+${digits}`;
  else if (digits.startsWith("250") && digits.length === 12) e164 = `+${digits}`;
  else if (isRwanda && digits.startsWith("0") && digits.length === 10) e164 = `+250${digits.slice(1)}`;
  else return null;

  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

const lookupCache = new Map<string, { value: WhatsappCheck; at: number }>();

function basicAuth(e: TwilioEnv): string {
  return `Basic ${Buffer.from(`${e.sid}:${e.token}`).toString("base64")}`;
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks Twilio Lookup whether a number is reachable on WhatsApp. Cached 24 hours.
 *
 * The result is advisory: any ambiguity (field not enabled on the account, a
 * timeout, an unexpected body) is "unknown", never "no", so a Lookup hiccup
 * cannot stop a trainee getting their exam. Only an explicit negative or an
 * invalid number is "no"/"invalid".
 */
export async function lookupWhatsapp(e164: string): Promise<WhatsappCheck> {
  const e = env();
  if (!e) return "unknown";

  const cached = lookupCache.get(e164);
  if (cached && Date.now() - cached.at < LOOKUP_CACHE_MS) return cached.value;

  let value: WhatsappCheck = "unknown";
  try {
    const res = await timedFetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=whatsapp`,
      { headers: { Authorization: basicAuth(e) } },
    );

    if (res.status === 404) {
      value = "invalid";
    } else if (res.ok) {
      const body = (await res.json().catch(() => null)) as {
        valid?: boolean;
        whatsapp?: { is_whatsapp?: boolean; is_whatsapp_user?: boolean } | null;
      } | null;
      if (body?.valid === false) value = "invalid";
      else {
        const flag = body?.whatsapp?.is_whatsapp ?? body?.whatsapp?.is_whatsapp_user;
        value = flag === true ? "yes" : flag === false ? "no" : "unknown";
      }
    } else {
      console.warn(`[whatsapp] lookup for ...${e164.slice(-4)} returned ${res.status}`);
    }
  } catch {
    console.warn(`[whatsapp] lookup for ...${e164.slice(-4)} failed or timed out`);
  }

  /* An "unknown" is not cached: it usually means a transient problem. */
  if (value !== "unknown") lookupCache.set(e164, { value, at: Date.now() });
  return value;
}

export interface WhatsappSendResult {
  ok: boolean;
  reason?: string;
}

export async function sendWhatsapp(e164: string, body: string): Promise<WhatsappSendResult> {
  const e = env();
  if (!e) return { ok: false, reason: "WhatsApp is not configured" };

  try {
    const res = await timedFetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(e.sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: basicAuth(e),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: `whatsapp:${e.from}`,
          To: `whatsapp:${e164}`,
          Body: body,
        }).toString(),
      },
    );

    if (res.ok) return { ok: true };

    console.warn(`[whatsapp] send to ...${e164.slice(-4)} returned ${res.status}`);
    return {
      ok: false,
      reason: res.status === 429 ? "WhatsApp rate limit reached, try again shortly" : "WhatsApp rejected the message",
    };
  } catch {
    console.warn(`[whatsapp] send to ...${e164.slice(-4)} failed or timed out`);
    return { ok: false, reason: "WhatsApp could not be reached" };
  }
}

export function examWhatsappMessage(input: {
  firstName: string;
  courseName: string;
  otp: string;
  examUrl: string;
  expiryMin: number;
}): string {
  return [
    `Hello ${input.firstName}, this is Kigali Safety Academy.`,
    `Your exam for ${input.courseName} is ready.`,
    `Your 6-digit code is ${input.otp}.`,
    `Click to start: ${input.examUrl}`,
    `Code expires in ${input.expiryMin} minutes.`,
  ].join("\n");
}
