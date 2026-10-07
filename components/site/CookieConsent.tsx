"use client";

import * as React from "react";
import Link from "next/link";
import { CookieIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The cookie consent banner.
 *
 * No choice is stored as a cookie itself: solving it directly (writing a
 * `ksa:cookie-consent` value to a cookie) is exactly the kind of adds-a-cookie
 * move the banner is meant to disclose, so the choice lives in localStorage
 * under the same key instead.
 */
const CONSENT_KEY = "ksa:cookie-consent";

type Choice = "accepted" | "essential" | "dismissed";

export function CookieConsent() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      setVisible(!window.localStorage.getItem(CONSENT_KEY));
    } catch {
      setVisible(true);
    }
  }, []);

  const choose = (choice: Choice) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      /* Storage blocked — just hide the banner for this page view. */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label="Cookie consent"
      className="no-print fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-lg sm:flex-row sm:items-center">
        <CookieIcon aria-hidden className="hidden size-5 shrink-0 text-orange sm:block" />
        <div className="flex-1 text-xs text-ink-2">
          <p className="font-medium text-ink">Cookies</p>
          <p className="mt-0.5">
            KSA uses only essential cookies — your sign-in session, security tokens and theme
            choice. No tracking or advertising cookies are set.{" "}
            <Link
              href="/cookies"
              className="text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              See the cookie policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => choose("essential")}>
            Essential only
          </Button>
          <Button type="button" size="sm" onClick={() => choose("accepted")}>
            Got it
          </Button>
        </div>
      </div>
    </aside>
  );
}