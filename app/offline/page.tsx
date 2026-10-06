import { CloudOffIcon } from "lucide-react";

import { RetryButton } from "@/components/pwa/retry-button";

export const dynamic = "force-static";

export const metadata = {
  title: "Offline",
};

/**
 * Shown by the service worker when a navigation fails and no cached page is
 * available. It is force-static so it is prerendered into the build and can be
 * precached — a page that needs the network cannot be the fallback for a
 * missing network.
 *
 * It renders no data and touches no session, which is the point: this is the
 * only HTML the worker serves from cache unconditionally.
 */
export default function OfflinePage() {
  return (
    <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-dvh items-center justify-center bg-paper px-6 outline-none"
      >
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-navy">
          <CloudOffIcon className="size-7 text-white" aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-semibold text-ink">You&apos;re offline</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Kigali Safety Academy needs a connection to load your trainees, exams and
          certificates. Reconnect and try again.
        </p>
        <p className="mt-6 text-xs text-ink-3">
          Nothing was lost — your last page is still waiting for you.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
