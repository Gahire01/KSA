/**
 * Kigali Safety Academy service worker.
 *
 * Deliberately conservative. This is an authenticated app, so the rules are:
 *
 *  - **Never cache a response that carries a session.** Everything under `/api`
 *    is network-only. A cached `/api/trainees` sitting in the Cache Storage of
 *    a shared or stolen device is a data breach, and no offline benefit is
 *    worth that.
 *  - **Cache the shell, not the data.** Static assets are immutable and
 *    content-hashed, so they are safe to keep. Navigations are network-first
 *    with a cached copy only as an offline fallback, so a user on a bad
 *    connection sees what they last saw rather than a browser error page —
 *    but the moment the network is back, the network wins.
 *  - **The exam runner is never served from cache.** A trainee must not be able
 *    to open a paper while offline, and a cached attempt page would show
 *    question state that has since moved on.
 *
 * Version bump `CACHE` to invalidate everything on the next deploy.
 */

const CACHE = "ksa-v1";

/** Only the app shell — pages a signed-in user might need while offline. */
const SHELL = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon.svg"];

/** Routes the worker must not touch at all. */
const NEVER = ["/api/", "/exam/", "/_next/image"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      /* `reload` rather than `default`: a precached URL may already sit in the
       * HTTP cache from an earlier visit, and we want the current build. */
      await Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function shouldNeverHandle(url) {
  return NEVER.some((prefix) => url.pathname.startsWith(prefix));
}

/**
 * Navigations: network first, cached copy as the offline fallback.
 *
 * A cached page is only ever shown when the network genuinely fails. That keeps
 * the offline experience honest — the user sees data as of their last visit,
 * never a silently stale one while online.
 */
async function handleNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok && fresh.type === "basic") {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match("/offline");
    if (shell) return shell;
    return new Response("You are offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/** Static, content-hashed assets: cache first, then refresh in the background. */
async function handleStatic(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) {
    /* Revalidate quietly; a failure just means the cached copy stays. */
    void fetch(request)
      .then((res) => {
        if (res.ok) void cache.put(request, res.clone());
      })
      .catch(() => {});
    return cached;
  }
  const fresh = await fetch(request);
  if (fresh.ok) void cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (shouldNeverHandle(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/logo.svg" ||
    /\.(?:png|svg|ico|jpg|jpeg|webp|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(handleStatic(request));
  }
  /* Everything else — HTML fragments, RSC payloads — goes straight to the
   * network untouched, so no request of ours is ever answered from storage. */
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") void self.skipWaiting();
});
