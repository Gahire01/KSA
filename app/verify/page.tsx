"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { extractToken } from "@/lib/certificates/token";

/**
 * /verify — the search form, for someone who has a certificate in hand rather than
 * the emailed link. Submitting redirects to `/verify/[token]`, which is the
 * server-rendered page that the certificate itself points at, so both routes land on
 * exactly the same view.
 *
 * The lookup is deliberately unauthenticated and only ever asks the public
 * projection for what it shows.
 */

export default function VerifyCertificatePage() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token") ?? "";
  const [draft, setDraft] = React.useState(tokenParam);
  const [touched, setTouched] = React.useState(Boolean(tokenParam));

  /* When a token is already in the URL, hand off to the canonical page rather than
   * duplicating the result here — one page owns the rendering. */
  React.useEffect(() => {
    if (tokenParam) window.location.replace(`/verify/${tokenParam}`);
  }, [tokenParam]);

  const token = extractToken(draft);

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

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-10">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-3xl font-semibold text-ink">
            Certificate verification
          </h1>
          <p className="mx-auto max-w-lg text-sm text-ink-2">
            Paste the verification link from the certificate or the email to confirm that a
            Kigali Safety Academy certificate is authentic and in date.
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (token.length > 8) window.location.assign(`/verify/${token}`);
              }}
            >
              <div className="relative flex-1">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
                  aria-hidden
                />
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Paste the verification link or token"
                  className="pl-9"
                  aria-label="Certificate verification link or token"
                />
              </div>
              <Button type="submit" className="gap-1.5">
                <SearchIcon className="size-4" />
                Verify
              </Button>
            </form>
        {touched && draft.trim().length <= 8 ? (
          <p className="mt-2 text-xs text-amber">
            Paste the verification link printed at the foot of the certificate.
          </p>
        ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">How verification works</CardTitle>
            <CardDescription>
              Every certificate issued by the academy carries a unique verification token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 text-sm text-ink-2 sm:grid-cols-3">
              <Step
                n={1}
                title="Find the link"
                body="The verification link is printed at the foot of the certificate and emailed to the holder."
              />
              <Step
                n={2}
                title="Paste it here"
                body="The whole link works, so it can be copied straight out of the email."
              />
              <Step
                n={3}
                title="Check the status"
                body="Valid, expiring, expired, or revoked — shown instantly with no login."
              />
            </ol>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-ink-3">
        Kigali Safety Academy · KN 07/MIN/EDUC/2024 · verification is provided as a
        demonstration service
      </footer>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-xl border border-line bg-paper p-3">
      <span className="flex size-6 items-center justify-center rounded-full bg-orange text-xs font-semibold text-white">
        {n}
      </span>
      <p className="mt-2 text-sm font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-xs">{body}</p>
    </li>
  );
}
