"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3Icon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  LoaderIcon,
  PrinterIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { MultiSelectFilter } from "@/components/shared/MultiSelectFilter";
import { DateRangePicker, type DateRange } from "@/components/shared/DateRangePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { mockApi } from "@/lib/mock";
import { formatDateTime, formatNumber } from "@/lib/utils/format";
import type { ReportFormat, ReportType } from "@/lib/types";

const FORMATS: { value: ReportFormat; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "pdf", label: "PDF", hint: "Print-ready, for filing", icon: FileTextIcon },
  { value: "xlsx", label: "Excel", hint: "Spreadsheet, for analysis", icon: FileSpreadsheetIcon },
  { value: "docx", label: "Word", hint: "Editable document", icon: FileTextIcon },
];

interface Generated {
  id: string;
  fileName: string;
  sizeKb: number;
  generatedAt: string;
  format: ReportFormat;
}

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const definitions = mockApi.reports.definitions;

  const [type, setType] = React.useState<ReportType>("trainee-roster");
  const [format, setFormat] = React.useState<ReportFormat>("xlsx");
  const [courseIds, setCourseIds] = React.useState<string[]>([]);
  const [range, setRange] = React.useState<DateRange>({});
  const [includeHeader, setIncludeHeader] = React.useState(true);
  const [includeFooter, setIncludeFooter] = React.useState(true);
  const [history, setHistory] = React.useState<Generated[]>([]);

  const coursesQuery = useQuery({
    queryKey: ["courses", "options"],
    queryFn: () => mockApi.courses.list(),
    staleTime: 5 * 60_000,
  });
  const courses = coursesQuery.data ?? [];

  const estimateQuery = useQuery({
    queryKey: [
      "reports",
      "estimate",
      type,
      courseIds,
      range.from ?? null,
      range.to ?? null,
    ],
    queryFn: () =>
      mockApi.reports.estimate(type, {
        courseIds: courseIds.length ? courseIds : undefined,
        from: range.from,
        to: range.to,
      }),
    enabled: Boolean(type),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      mockApi.reports.generate({ type, format, includeHeader, includeFooter }),
    onSuccess: (result) => {
      setHistory((h) => [result, ...h].slice(0, 6));
      toast.success("Report ready", {
        description: `${result.fileName} · ${formatNumber(result.sizeKb)} KB`,
      });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: () => toast.error("The report could not be generated."),
  });

  const active = definitions.find((d) => d.type === type);

  return (
    <div className="space-y-5">
      <DemoBanner>
        Report figures are calculated from demo data, and generated files are not
        saved anywhere.
      </DemoBanner>

      <PageHeader
        title="Reports"
        subtitle="Generate register extracts for regulators, funders, and internal review."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Choose a report</CardTitle>
              <CardDescription>
                Each report is generated from the live dataset with the filters you set.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {definitions.map((d) => {
                  const isActive = d.type === type;
                  return (
                    <button
                      key={d.type}
                      type="button"
                      onClick={() => setType(d.type)}
                      className={
                        isActive
                          ? "rounded-xl border-2 border-orange bg-orange/5 p-3 text-left"
                          : "rounded-xl border border-line p-3 text-left transition-colors hover:bg-paper"
                      }
                      aria-pressed={isActive}
                    >
                      <p className="flex items-center gap-2 text-sm font-medium text-ink">
                        <BarChart3Icon className="size-4 shrink-0 text-orange" />
                        {d.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-2">{d.description}</p>
                      <p className="mt-1.5 text-[11px] text-ink-3">
                        ~{formatNumber(d.rowEstimate)} rows unfiltered
                      </p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Output</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink">Format</legend>
                <RadioGroup
                  value={format}
                  onValueChange={(v) => setFormat(v as ReportFormat)}
                  className="gap-2 sm:flex-row"
                >
                  {FORMATS.map((f) => {
                    const Icon = f.icon;
                    return (
                      <label
                        key={f.value}
                        htmlFor={`format-${f.value}`}
                        className={
                          format === f.value
                            ? "flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border-2 border-orange bg-orange/5 px-3 py-2"
                            : "flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 transition-colors hover:bg-paper"
                        }
                      >
                        <RadioGroupItem value={f.value} id={`format-${f.value}`} />
                        <Icon className="size-4 text-ink-2" />
                        <span>
                          <span className="block text-sm font-medium text-ink">{f.label}</span>
                          <span className="block text-xs text-ink-3">{f.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Scope</Label>
                  <MultiSelectFilter
                    label="Courses"
                    searchable
                    width="w-full"
                    options={courses.map((c) => ({ value: c.id, label: c.name, hint: c.code }))}
                    selected={courseIds}
                    onChange={(next) => setCourseIds(next as string[])}
                  />
                  <p className="text-xs text-ink-3">
                    {courseIds.length === 0
                      ? "All courses"
                      : `${courseIds.length} course${courseIds.length === 1 ? "" : "s"} selected`}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Period</Label>
                  <DateRangePicker value={range} onChange={setRange} label="Between" />
                  <p className="text-xs text-ink-3">
                    {range.from || range.to ? "Filtered by date" : "All time"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2.5">
                  <Checkbox
                    checked={includeHeader}
                    onCheckedChange={(v) => setIncludeHeader(Boolean(v))}
                  />
                  <span className="text-sm text-ink">
                    Include the academy letterhead and generation timestamp
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2.5">
                  <Checkbox
                    checked={includeFooter}
                    onCheckedChange={(v) => setIncludeFooter(Boolean(v))}
                  />
                  <span className="text-sm text-ink">
                    Include a footer with page numbers and the verification contact
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Generate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-paper p-3">
                <p className="text-sm font-medium text-ink">{active?.title}</p>
                <p className="mt-0.5 text-xs text-ink-2">{active?.description}</p>
                <p className="mt-2 text-sm text-ink-2">
                  {estimateQuery.isFetching ? (
                    "Counting rows…"
                  ) : (
                    <>
                      Estimated{" "}
                      <span className="font-semibold text-ink tabular">
                        {formatNumber(estimateQuery.data?.rows ?? 0)}
                      </span>{" "}
                      {estimateQuery.data?.label ?? "rows"}
                    </>
                  )}
                </p>
              </div>
              <Button
                className="w-full gap-1.5"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : (
                  <DownloadIcon className="size-4" />
                )}
                {generateMutation.isPending ? "Generating…" : "Generate report"}
              </Button>
              {generateMutation.isPending ? (
                <p className="text-center text-xs text-ink-3" role="status">
                  Compiling rows and formatting {format.toUpperCase()}… this takes a
                  moment.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {history.length > 0 ? (
            <Card>
              <CardHeader className="gap-1">
                <CardTitle className="text-base">Recent exports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start gap-2 rounded-lg border border-line px-3 py-2"
                  >
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-green" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-ink">{h.fileName}</p>
                      <p className="text-[11px] text-ink-3">
                        {formatNumber(h.sizeKb)} KB ·{" "}
                        {formatDateTime(h.generatedAt)}
                      </p>
                    </div>
                    <Badge variant="outline">{h.format.toUpperCase()}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {history.length === 0 ? (
        <Card className="print:hidden">
          <CardContent className="space-y-2">
            <EmptyState
              compact
              title="No reports generated in this session"
              description="Generated files are listed on the right with their size and timestamp. In production they would be emailed and stored for 12 months."
            />
            <p className="flex items-center justify-center gap-1.5 text-xs text-ink-3">
              <PrinterIcon className="size-3.5" />
              Registers are also printed on the academy letterhead for accreditation visits.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
