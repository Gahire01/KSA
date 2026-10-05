import { cookies } from "next/headers";

/** Sessions last 7 days. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const DEV_COOKIE = "ksa_session";
/**
 * The `__Host-` prefix is only honoured by browsers over HTTPS, so in local dev
 * (plain http://localhost) the cookie must use an unprefixed name or the browser
 * will silently drop it.
 */
const PROD_COOKIE = "__Host-ksa_session";

export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? PROD_COOKIE : DEV_COOKIE;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(sessionCookieName())?.value ?? null;
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(sessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
