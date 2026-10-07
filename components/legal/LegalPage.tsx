import type { ReactNode } from "react";
import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";

/**
 * Shell for the public legal pages (/privacy, /terms, /cookies, /refund-policy):
 * the same header and footer as certificate verification, so legal copy renders
 * in the site chrome instead of a naked prose page.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Logo href="/verify" />
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Staff sign in</Link>
          </Button>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-10 outline-none"
      >
        <article className="space-y-8">
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
            <p className="text-xs text-ink-3">Last updated {updated}</p>
          </div>
          {children}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}