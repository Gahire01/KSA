"use client";

import { RefreshCwIcon } from "lucide-react";

/**
 * Reload lives here rather than on the page because the retry must happen in
 * the browser: the service worker is what decides whether the next navigation
 * resolves from the network or from cache, and only the client can ask for it.
 */
export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-strong px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-stronger focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <RefreshCwIcon className="size-4" aria-hidden />
      Try again
    </button>
  );
}
