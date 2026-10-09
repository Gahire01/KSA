"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3Icon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { MultiSelectFilter } from "@/components/shared/MultiSelectFilter";
import { DateRangePicker, type DateRange } from "@/components/shared/DateRangePicker";
import { exportUrl, type ExportType } from "@/components/shared/ExportMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * /reports — branded Excel and PDF exports of the academy's records. Each file is built
 * from the database on request with the filters set here (no CSV). The same exports are
 * one click away from the Trainees, Payments, Certificates and Audit log pages.
 */

const REPORTS: Array<{
  type: ExportType;
  title: string;
  description: string;
  filters: Array<"course" | "method" | "dates">;
  ownerOnly?: boolean;
}> = [
  { type: "trainee-roster", title: "Trainee roster", description: "Everyone enrolled, with course, status and fees paid.", filters: ["course", "dates"] },
  { type: "payments", title: "Payments", description: "Every receipt and refund, with method and who recorded it.", filters: ["course", "method", "dates"] },
  { type: "exam-results", title: "Exam results", description: "Every sitting: score, outcome and times the window was left.", filters: ["course", "dates"] },
  { type: "certificate-register", title: "Certificate register", description: "Every certificate issued, valid or revoked.", filters: ["course", "dates"] },
  { type: "audit-log", title: "Audit log", description: "The append-only record of privileged actions.", filters: ["dates"], ownerOnly: true },
];

const METHODS = [
  { value: "MOMO", label: "Mobile money" },
  { value: "BANK", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
];

export default function ReportsPage() {
  const isOwner = useAuthStore((s) => s.currentUser?.role === "OWNER");
  const available = REPORTS.filter((r) => !r.ownerOnly || isOwner);

  const [type, setType] = React.useState<ExportType>("trainee-roster");
  const [courseIds, setCourseIds] = React.useState<string[]>([]);
  const [methods, setMethods] = React.useState<string[]>([]);
  const [range, setRange] = React.useState<DateRange>({});

  const coursesQuery = useQuery({
    queryKey: ["courses", "options"],
    queryFn: async () => (await api.get<{ items: Array<{ id: string; name: string }> }>("/courses", { pageSize: 100 })).items,
    staleTime: 5 * 60_000,
  });

  const active = available.find((r) => r.type === type) ?? available[0];
  if (!active) return null;

  const params = {
    courseIds: active.filters.includes("course") ? courseIds : undefined,
    methods: active.filters.includes("method") ? methods : undefined,
    from: active.filters.includes("dates") ? range.from : undefined,
    to: active.filters.includes("dates") ? range.to : undefined,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Download branded Excel or PDF files for regulators, funders and internal review."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Choose a report</CardTitle>
            <CardDescription>Each file is built from the live records with the filters you set.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((r) => {
                const isActive = r.type === active.type;
                return (
                  <button
                    key={r.type}
                    type="button"
                    onClick={() => setType(r.type)}
                    aria-pressed={isActive}
                    className={
                      isActive
                        ? "rounded-xl border-2 border-orange bg-orange/5 p-3 text-left"
                        : "rounded-xl border border-line p-3 text-left transition-colors hover:bg-paper"
                    }
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      <BarChart3Icon className="size-4 shrink-0 text-orange" />
                      {r.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-2">{r.description}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-20 lg:self-start">
          <CardHeader className="gap-1">
            <CardTitle className="text-base">{active.title}</CardTitle>
            <CardDescription>Filters are optional. Leave them empty for everything.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {active.filters.includes("course") ? (
              <MultiSelectFilter
                label="Course"
                options={(coursesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                selected={courseIds}
                onChange={setCourseIds}
                width="w-72"
              />
            ) : null}
            {active.filters.includes("method") ? (
              <MultiSelectFilter label="Method" options={METHODS} selected={methods} onChange={setMethods} />
            ) : null}
            {active.filters.includes("dates") ? <DateRangePicker value={range} onChange={setRange} /> : null}

            <div className="grid gap-2 pt-1">
              <Button asChild className="gap-1.5">
                <a href={exportUrl(active.type, "xlsx", params)} download>
                  <FileSpreadsheetIcon className="size-4" />
                  Download Excel
                </a>
              </Button>
              <Button asChild variant="outline" className="gap-1.5">
                <a href={exportUrl(active.type, "pdf", params)} download>
                  <FileTextIcon className="size-4" />
                  Download PDF
                </a>
              </Button>
            </div>
            <p className="text-xs text-ink-3">
              PDFs show the first 1,500 rows; Excel always has them all. Every download is recorded in the audit log.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
