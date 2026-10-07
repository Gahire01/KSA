"use client";

import * as React from "react";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Topbar "Install app" button.
 *
 * Browsers that can install the PWA fire `beforeinstallprompt`; we hold the event
 * and show the button, and hand the event back to the browser when it is clicked.
 * Nothing shows where the event never fires (already installed, or a browser such
 * as Safari that installs from the share sheet instead).
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallButton() {
  const [deferred, setDeferred] = React.useState<InstallPromptEvent | null>(null);

  React.useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="hidden gap-1.5 sm:inline-flex"
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice.catch(() => undefined);
        /* An event can only be used once, whatever the answer. */
        setDeferred(null);
      }}
    >
      <DownloadIcon className="size-4" />
      Install app
    </Button>
  );
}
