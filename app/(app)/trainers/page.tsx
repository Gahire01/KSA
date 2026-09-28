"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AwardIcon,
  BadgeCheckIcon,
  BookOpenIcon,
  MailIcon,
  PhoneIcon,
  SignatureIcon,
  UsersIcon,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { mockApi } from "@/lib/mock";
import { formatDate, formatNumber } from "@/lib/utils/format";

export default function TrainersPage() {
  const [searchDraft, setSearchDraft] = React.useState("");
  const search = useDebounce(searchDraft, 200);

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: () => mockApi.trainers.list(),
    staleTime: 5 * 60_000,
  });
  const coursesQuery = useQuery({
    queryKey: ["courses", "options"],
    queryFn: () => mockApi.courses.list(),
    staleTime: 5 * 60_000,
  });

  const courses = React.useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const trainers = React.useMemo(() => trainersQuery.data ?? [], [trainersQuery.data]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trainers;
    return trainers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.licenseNo.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q),
    );
  }, [trainers, search]);

  const totals = React.useMemo(
    () => ({
      trainers: trainers.length,
      cohorts: courses.length,
      certificates: trainers.reduce((s, t) => s + t.certificatesIssued, 0),
      signers: trainers.filter((t) => t.isDefaultSigner).length,
    }),
    [trainers, courses],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trainers"
        subtitle={`${formatNumber(totals.trainers)} trainers · ${formatNumber(totals.certificates)} certificates signed`}
        actions={
          <div className="w-56">
            <SearchInput
              value={searchDraft}
              onValueChange={setSearchDraft}
              placeholder="Search trainers…"
            />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-orange/10 text-orange">
              <UsersIcon className="size-5" />
            </span>
            <div>
              <p className="text-xs tracking-wider text-ink-2 uppercase">Trainers</p>
              <p className="font-display text-xl font-semibold text-ink tabular">
                {formatNumber(totals.trainers)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-navy/10 text-navy">
              <BookOpenIcon className="size-5" />
            </span>
            <div>
              <p className="text-xs tracking-wider text-ink-2 uppercase">Courses covered</p>
              <p className="font-display text-xl font-semibold text-ink tabular">
                {formatNumber(totals.cohorts)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-green-bg text-green">
              <AwardIcon className="size-5" />
            </span>
            <div>
              <p className="text-xs tracking-wider text-ink-2 uppercase">Certificates signed</p>
              <p className="font-display text-xl font-semibold text-ink tabular">
                {formatNumber(totals.certificates)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-ink-2">
              <SignatureIcon className="size-5" />
            </span>
            <div>
              <p className="text-xs tracking-wider text-ink-2 uppercase">Default signers</p>
              <p className="font-display text-xl font-semibold text-ink tabular">
                {formatNumber(totals.signers)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {trainersQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No trainers match that search"
          description="Try a name, email or licence number."
          action={
            <Button size="sm" variant="outline" onClick={() => setSearchDraft("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((t) => {
            const own = courses.filter((c) => c.trainerId === t.id);
            const load = own.reduce((s, c) => s + c.enrolledCount, 0);
            return (
              <Card key={t.id}>
                <CardHeader className="gap-3">
                  <div className="flex items-start gap-3">
                    <AvatarInitials name={t.name} />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base flex flex-wrap items-center gap-2">
                        {t.name}
                        {t.isDefaultSigner ? (
                          <Badge variant="green" className="gap-1">
                            <BadgeCheckIcon className="size-3" />
                            Default signer
                          </Badge>
                        ) : null}
                      </CardTitle>
                      <CardDescription className="mt-0.5">{t.title}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <MailIcon className="size-3.5" />
                      {t.email}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <PhoneIcon className="size-3.5" />
                      {t.phone}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-ink-2">{t.bio}</p>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-paper px-3 py-2 text-center">
                    <Metric label="Cohorts" value={formatNumber(own.length)} />
                    <Metric label="Trainees" value={formatNumber(load)} />
                    <Metric label="Signed" value={formatNumber(t.certificatesIssued)} />
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold tracking-wider text-ink-2 uppercase">
                      Courses
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {own.map((c) => (
                        <li key={c.id}>
                          <Badge variant="outline">{c.code}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="font-mono text-xs text-ink-3">
                      Licence {t.licenseNo} · since {formatDate(t.activeSince)}
                    </p>
                    <div className="flex gap-1.5">
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`Email ${t.name}`}>
                        <a href={`mailto:${t.email}`}>
                          <MailIcon className="size-4" />
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={`mailto:${t.email}?subject=Kigali Safety Academy roster`}>
                          Request roster
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-wider text-ink-2 uppercase">{label}</p>
      <p className="font-display text-base font-semibold text-ink tabular">{value}</p>
    </div>
  );
}
