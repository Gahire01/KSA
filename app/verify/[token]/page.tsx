import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  CertificateNotFound,
  CertificateResult,
} from "@/components/verify/CertificateResult";
import { getPublicCertificate } from "@/lib/certificates/verify";

/**
 * /verify/[token] — the link that goes on the certificate and in the email.
 *
 * A server component, not a client fetch: the result is in the initial HTML, so it
 * works with JavaScript disabled and the token never has to be replayed to an API.
 *
 * `force-dynamic` because the token is in the URL and the answer changes with the
 * clock — a certificate must not be cached as valid and then expire for an employer
 * who reloads from cache.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify certificate",
  description: "Confirm that a Kigali Safety Academy certificate is authentic and in date.",
  robots: { index: false, follow: false },
};

export default async function VerifyTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cert = await getPublicCertificate(token);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Staff sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl space-y-5 px-4 py-10 outline-none"
      >
        <div className="space-y-1 text-center">
          <h1 className="font-display text-3xl font-semibold text-ink">
            Certificate verification
          </h1>
          <p className="mx-auto max-w-lg text-sm text-ink-2">
            The academy&apos;s record for this certificate is below. No sign-in is needed.
          </p>
        </div>

        {cert ? <CertificateResult cert={cert} /> : <CertificateNotFound />}

        <p className="text-center text-xs text-ink-3">
          Have a different certificate?{" "}
          <Link href="/verify" className="font-medium text-green underline">
            Look up another
          </Link>
        </p>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-ink-3">
        Kigali Safety Academy · KN 07/MIN/EDUC/2024 · public certificate
        verification
      </footer>
    </div>
  );
}
