"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpenIcon, MailIcon, UsersIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { formatDate, formatNumber } from "@/lib/utils/format";

/**
 * /trainers — the people who run courses, from the database. A trainer has no
 * password: the owner creates the record, then gives them a link (see Access).
 */

interface Trainer {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
}

interface CourseRow {
  id: string;
  code: string;
  name: string;
  trainerId: string | null;
  isActive: boolean;
  _count: { trainees: number };
}

export default function TrainersPage() {
  const [searchDraft, setSearchDraft] = React.useState("");
  const search = useDebounce(searchDraft, 200);

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: async () => (await api.get<{ items: Trainer[] }>("/trainers")).items,
    staleTime: 5 * 60_000,
  });
  const coursesQuery = useQuery({
    queryKey: ["courses", "trainer-load"],
    queryFn: async () => (await api.get<{ items: CourseRow[] }>("/courses", { pageSize: 100 })).items,
    staleTime: 5 * 60_000,
  });

  const trainers = React.useMemo(() => trainersQuery.data ?? [], [trainersQuery.data]);
  const courses = React.useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trainers;
    return trainers.filter((t) => (t.name ?? "").toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
  }, [trainers, search]);

  const assigned = courses.filter((c) => c.trainerId).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trainers"
        subtitle={`${formatNumber(trainers.length)} trainer${trainers.length === 1 ? "" : "s"} · ${formatNumber(assigned)} course${assigned === 1 ? "" : "s"} assigned`}
        actions={
          <div className="flex items-center gap-2">
            <div className="w-56">
              <SearchInput value={searchDraft} onValueChange={setSearchDraft} placeholder="Search trainers…" />
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/access">Give a trainer access</Link>
            </Button>
          </div>
        }
      />

      {trainersQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trainers.length === 0 ? "No trainers yet" : "No trainers match that search"}
          description={
            trainers.length === 0
              ? "Trainers you add appear here, with the courses they run."
              : "Try a name or an email."
          }
          action={
            search ? (
              <Button size="sm" variant="outline" onClick={() => setSearchDraft("")}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((t) => {
            const own = courses.filter((c) => c.trainerId === t.id);
            const load = own.reduce((sum, c) => sum + c._count.trainees, 0);
            const display = t.name ?? t.email;
            return (
              <Card key={t.id}>
                <CardHeader className="gap-3">
                  <div className="flex items-start gap-3">
                    <AvatarInitials name={display} />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{display}</CardTitle>
                      <CardDescription className="mt-0.5 flex items-center gap-1.5">
                        <MailIcon className="size-3.5" />
                        {t.email}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-paper px-3 py-2 text-center">
                    <Metric icon={<BookOpenIcon className="size-3.5" />} label="Courses" value={formatNumber(own.length)} />
                    <Metric icon={<UsersIcon className="size-3.5" />} label="Trainees" value={formatNumber(load)} />
                  </div>

                  {own.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {own.map((c) => (
                        <li key={c.id}>
                          <Badge variant="outline">{c.code}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-3">No course assigned yet.</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="text-xs text-ink-3">Added {formatDate(t.createdAt)}</p>
                    <Button asChild variant="outline" size="sm">
                      <a href={`mailto:${t.email}`}>Email</a>
                    </Button>
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

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1 text-[10px] tracking-wider text-ink-2 uppercase">
        {icon}
        {label}
      </p>
      <p className="font-display text-base font-semibold text-ink tabular">{value}</p>
    </div>
  );
}
