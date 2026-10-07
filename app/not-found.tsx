import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";

/**
 * Custom 404 in the site chrome. No sign-in needed, same header/footer as the
 * public pages, with the two ways back that actually help.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Logo />
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center outline-none"
      >
        <p className="font-mono text-sm font-medium text-orange">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
          This page does not exist
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
          The address may be mistyped, or the link may have expired. Try the
          certificate verification page, or sign in from the link below.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/verify">Verify a certificate</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Staff sign in</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}