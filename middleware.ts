import { NextResponse, type NextRequest } from "next/server";

/**
 * Two responsibilities, one file:
 *
 *  1. CSRF for the API. The session cookie is SameSite=Lax, which already
 *     stops a cross-site page from sending it on a POST. This is a second
 *     layer: every state-changing API request must come from our own origin,
 *     judged by headers a browser sets and a page cannot forge.
 *
 *  2. Stale session-cookie cleanup for app pages. `getSession()` runs in a
 *     Server Component and cannot write cookies (Next.js 15). Whenever the
 *     browser presents a cookie that is clearly empty or invalid, we delete
 *     it here so it stops being sent on every request.
 *
 * A request carrying neither `Sec-Fetch-Site` nor `Origin` is not a browser
 * acting on someone's behalf, so it is allowed: it has no ambient credentials
 * to abuse.
 */

export const config = {
  matcher: [
    /*
     * Everything except Next.js static assets. API CSRF still applies only to
     * `/api/*` below — this wider matcher is what lets us clean stale cookies
     * on page navigations too.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)",
  ],
};

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const SESSION_COOKIE = "ksa_session";

function blocked() {
  return NextResponse.json(
    {
      ok: false,
      error: "This request was blocked because it did not come from this site.",
    },
    { status: 403 },
  );
}

/**
 * Every host name this site is legitimately served under.
 */
function ownHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>([request.nextUrl.host]);

  const host = request.headers.get("host");
  if (host) hosts.add(host);

  const forwarded = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (forwarded) hosts.add(forwarded);

  for (const configured of [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    if (!configured) continue;
    try {
      hosts.add(new URL(configured).host);
    } catch {
      /* A malformed env value must not open the check up. */
    }
  }

  return hosts;
}

/**
 * Deletes a session cookie whose value is obviously unusable (empty string,
 * literal "undefined" / "null"). We cannot verify expiry here without a DB
 * round-trip, so we leave well-formed cookies alone — `getSession()` will
 * delete the DB row if the session is invalid, and the cookie simply carries
 * no weight after that.
 */
function withStaleCookieCleanup(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token === "" || token === "undefined" || token === "null") {
    response.cookies.delete(SESSION_COOKIE);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* Page navigations: only stale-cookie cleanup, no CSRF gate. */
  if (!pathname.startsWith("/api/")) {
    return withStaleCookieCleanup(request, NextResponse.next());
  }

  /* API: CSRF gate, plus the same cleanup on every response we emit. */
  if (SAFE.has(request.method)) {
    return withStaleCookieCleanup(request, NextResponse.next());
  }

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return withStaleCookieCleanup(request, blocked());
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return withStaleCookieCleanup(request, blocked());
    }
    if (!ownHosts(request).has(originHost)) {
      return withStaleCookieCleanup(request, blocked());
    }
  } else if (origin === "null") {
    /* Sandboxed iframes and some redirects send the literal string "null". */
    return withStaleCookieCleanup(request, blocked());
  }

  return withStaleCookieCleanup(request, NextResponse.next());
}