import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Proof-of-OTP cookie for the exam runner.
 *
 * Once the six-digit code verifies, the browser gets this cookie and every
 * subsequent exam call (next question, autosave, submit) checks it. Without it
 * an unauthenticated visitor holding only the emailed link could drive an
 * attempt without ever proving they read the code.
 *
 * The cookie carries the attempt id and a keyed HMAC of it — no expiry, no
 * user data. It is validated against the attempt's own status and tokenHash on
 * every request, so replaying it after submission is refused.
 */

/** 2 hours. The exam itself is usually far shorter; this is a hard ceiling. */
export const EXAM_SESSION_TTL_SECONDS = 60 * 60 * 2;

const MAX_TOKEN_LENGTH = 128;

function examSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters.",
    );
  }
  return secret;
}

/** Cookie names are length-capped so the header cannot be abused. */
function cookieName(token: string): string {
  const safe = token.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48);
  return `exam_session_${safe}`;
}

function sign(attemptId: string): string {
  return createHmac("sha256", examSecret()).update(attemptId).digest("base64url");
}

export async function setExamSessionCookie(
  token: string,
  attemptId: string,
): Promise<void> {
  const store = await cookies();
  store.set(cookieName(token), `${attemptId}.${sign(attemptId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: EXAM_SESSION_TTL_SECONDS,
  });
}

export async function clearExamSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(cookieName(token), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Returns the attempt id when the cookie matches this exact attempt.
 *
 * The HMAC is compared in constant time, and a mismatched or absent cookie
 * simply yields null — never an error the caller might leak.
 */
export async function readExamSession(token: string, attemptId: string): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(cookieName(token))?.value;
  if (!raw || raw.length > MAX_TOKEN_LENGTH) return false;

  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return false;

  const presentedId = raw.slice(0, separator);
  const presentedMac = raw.slice(separator + 1);

  if (presentedId !== attemptId) return false;

  const expected = Buffer.from(sign(attemptId));
  const actual = Buffer.from(presentedMac);
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}