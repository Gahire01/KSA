"use client";

import * as React from "react";

/**
 * Registers the service worker.
 *
 * Production only. In dev the chunks are re-hashed on every compile and the
 * HMR socket must stay open, so a worker that caches `/_next/static` would hand
 * back stale code and quietly break hot reload.
 *
 * Registration is deliberately fire-and-forget and never throws into render:
 * a browser without SW support (or with it blocked by policy) simply gets the
 * app with no offline layer, which is the correct degradation.
 */
export function ServiceWorkerRegistration() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const register = () => {
      if (cancelled) return;
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error: unknown) => {
          console.warn("[pwa] service worker registration failed", error);
        });
    };

    /* `load` rather than this effect's immediate run: registering during page
     * load competes with the app's own fetches for the connection. */
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
