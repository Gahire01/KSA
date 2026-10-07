import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF defence for the API.
 *
 * The session cookie is SameSite=Lax, which already stops a cross-site page from
 * sending it on a POST. This is the second layer behind it: every state-changing
 * request must come from our own origin, judged by the headers a browser sets and a
 * page cannot forge.
 *
 *  - `Sec-Fetch-Site` (sent by every current browser): only `same-origin`, or `none`
 *    (a user-typed URL or bookmark), may change state. `same-site` is refused too:
 *    a sibling subdomain is not us.
 *  - `Origin`, when present, must be this host (covers older browsers).
 *
 * A request carrying neither header is not a browser acting on someone's behalf (a
 * browser attaching the victim's cookies always sends one of them), so it is allowed:
 * it has no ambient credentials to abuse.
 *
 * This replaces a double-submit token. It needs no client changes and no token to
 * leak, and it covers the same attack, a forged cross-site request.
 */

export const config = { matcher: "/api/:path*" };

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

function blocked() {
  return NextResponse.json(
    { ok: false, error: "This request was blocked because it did not come from this site." },
    { status: 403 },
  );
}

/**
 * Every host name this site is legitimately served under. Behind a proxy the Host
 * the app sees can differ from the one in the browser's Origin, so the forwarded
 * host and the configured public URL count too. A cross-site page cannot set any of
 * these: Origin is written by the browser, not by the page.
 */
function ownHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>([request.nextUrl.host]);

  const host = request.headers.get("host");
  if (host) hosts.add(host);

  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded) hosts.add(forwarded);

  for (const configured of [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!configured) continue;
    try {
      hosts.add(new URL(configured).host);
    } catch {
      /* A malformed env value must not open the check up. */
    }
  }

  return hosts;
}

export function middleware(request: NextRequest) {
  if (SAFE.has(request.method)) return NextResponse.next();

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return blocked();

  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return blocked();
    }
    if (!ownHosts(request).has(originHost)) return blocked();
  } else if (origin === "null") {
    /* Sandboxed iframes and some redirects send the literal string "null". */
    return blocked();
  }

  return NextResponse.next();
}
