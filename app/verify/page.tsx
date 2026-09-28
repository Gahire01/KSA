"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheckIcon,
  CalendarIcon,
  GraduationCapIcon,
  LoaderIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldXIcon,
} from "lucide-react";

import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { mockApi } from "@/lib/mock";
import { formatDate } from "@/lib/utils/format";
import type { CertificateStatus } from "@/lib/types";

const STATUS_COPY: Record<
  CertificateStatus,
  { heading: string; body: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  VALID: {
    heading: "Authentic certificate",
    body: "This certificate was issued by Kigali Safety Academy and is currently valid.",
    icon: ShieldCheckIcon,
    tone: "text-green",
  },
  EXPIRING: {
    heading: "Valid, renewal due",
    body: "This certificate is still valid but expires within the next 30 days. Renew it to stay compliant.",
    icon: ShieldAlertIcon,
    tone: "text-amber",
  },
  EXPIRED: {
    heading: "Expired certificate",
    body: "The validity period has ended. The holder must retake the course to be recertified.",
    icon: ShieldXIcon,
    tone: "text-red",
  },
  REVOKED: {
    heading: "Revoked certificate",
    body: "This certificate was revoked by the academy. Treat it as invalid and contact us for details.",
    icon: ShieldXIcon,
    tone: "text-red",
  },
};

export default function VerifyCertificatePage() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token") ?? "";
  const [draft, setDraft] = React.useState(tokenParam);
  const [token, setToken] = React.useState(tokenParam);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (tokenParam) {
      setDraft(tokenParam);
      setToken(tokenParam);
    }
  }, [tokenParam]);

  const lookup = useQuery({
    queryKey: ["certificate", "verify", token],
    queryFn: () => mockApi.certificates.byToken(token.trim()),
    enabled: token.trim().length > 8,
    retry: false,
  });

  const data = lookup.data;
  const status = data?.certificate.status;
  const copy = status ? STATUS_COPY[status] : null;
  const Icon = copy?.icon ?? LoaderIcon;

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
          <h1 className="font-display text-3xl font-semibold text-ink">Certificate verification</h1>
          <p className="mx-auto max-w-lg text-sm text-ink-2">
            Enter the certificate number or paste a verification link to confirm that a
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
                setToken(draft.trim());
                const url = new URL(window.location.href);
                url.searchParams.set("token", draft.trim());
                window.history.replaceState(null, "", url);
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
                  placeholder="KSA-2025-0001 or paste the full link"
                  className="pl-9"
                  aria-label="Certificate number or verification token"
                />
              </div>
              <Button type="submit" className="gap-1.5">
                <SearchIcon className="size-4" />
                Verify
              </Button>
            </form>
            {touched && draft.trim().length <= 8 ? (
              <p className="mt-2 text-xs text-amber">
                Enter at least the certificate number and token printed on the certificate.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {lookup.isFetching ? (
          <Card>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ) : null}

        {data && copy ? (
          <Card
            className={
              status === "VALID"
                ? "border-green/40"
                : status === "EXPIRING"
                  ? "border-amber/40"
                  : "border-red/40"
            }
          >
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full bg-paper ${copy.tone}`}
                  aria-hidden
                >
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-semibold text-ink">
                    {copy.heading}
                  </h2>
                  <p className="mt-1 text-sm text-ink-2">{copy.body}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3">
                <AvatarInitials name={data.trainee?.name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {data.trainee?.name ?? "Unknown holder"}
                  </p>
                  <p className="truncate font-mono text-xs text-ink-3">
                    {data.trainee?.traineeNo ?? data.certificate.traineeId}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {status}
                </Badge>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail
                  icon={<GraduationCapIcon className="size-4" />}
                  label="Course"
                  value={data.course?.name ?? "—"}
                  sub={data.course ? `${data.course.durationValue} ${data.course.durationUnit}s · ${data.course.category}` : undefined}
                />
                <Detail
                  icon={<CalendarIcon className="size-4" />}
                  label="Issued"
                  value={formatDate(data.certificate.issuedAt)}
                  sub={
                    data.certificate.expiresAt
                      ? `Valid until ${formatDate(data.certificate.expiresAt)}`
                      : "No expiry date"
                  }
                />
                <Detail
                  icon={<BadgeCheckIcon className="size-4" />}
                  label="Assessment"
                  value={`Score ${data.certificate.score}%`}
                  sub={data.certificate.durationLabel}
                />
                <Detail
                  icon={<ShieldCheckIcon className="size-4" />}
                  label="Issued by"
                  value={data.trainer?.name ?? "—"}
                  sub={data.trainer ? `Trainer ${data.trainer.id}` : undefined}
                />
              </dl>

              <div className="space-y-1 border-t border-line pt-4 font-mono text-xs text-ink-3">
                <p>Certificate no. {data.certificate.certNo}</p>
                <p>Verification token {data.certificate.verificationToken}</p>
                <p>Content hash {data.certificate.contentHash}</p>
              </div>

              {status === "REVOKED" && data.certificate.revokeReason ? (
                <p className="rounded-lg bg-red-bg px-3 py-2 text-sm text-red">
                  Revocation reason: {data.certificate.revokeReason}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {lookup.isError || (touched && !lookup.isFetching && !data && draft.trim().length > 8) ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <span
                className="flex size-12 items-center justify-center rounded-full bg-red-bg text-red"
                aria-hidden
              >
                <ShieldXIcon className="size-6" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  No certificate matches that code
                </h2>
                <p className="mt-1 text-sm text-ink-2">
                  Check for typing mistakes, or contact the academy if you believe the
                  certificate is genuine.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

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
                title="Find the code"
                body="The certificate number and token are printed at the foot of the certificate."
              />
              <Step
                n={2}
                title="Paste it here"
                body="The token is part of the verification link emailed to the holder."
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

function Detail({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-ink-3" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold tracking-wider text-ink-2 uppercase">{label}</dt>
        <dd className="truncate text-sm font-medium text-ink">{value}</dd>
        {sub ? <dd className="truncate text-xs text-ink-3">{sub}</dd> : null}
      </div>
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
