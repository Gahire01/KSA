"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockApi } from "@/lib/mock";
import { cn } from "@/lib/utils/cn";
import type { CsvPreviewRow, Trainee } from "@/lib/types";

type Step = "upload" | "preview" | "done";

const SAMPLE = `name,email,phone,country,category,course,amountPaid
Clarisse Uwase,clarisse.uwase@example.com,+250 788 111 222,Rwanda,Firefighters,FSL1,45000
Patrick Habimana,p.habimana@example.com,+250 788 333 444,Rwanda,Maintenance,HEIG,45000`;

const REQUIRED_HEADERS = ["name", "email", "course"];

export default function ImportTraineesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = React.useState<Step>("upload");
  const [fileName, setFileName] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [, setRows] = React.useState<string[][]>([]);
  const [preview, setPreview] = React.useState<CsvPreviewRow[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [rawText, setRawText] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const parseMutation = useMutation({
    mutationFn: async (text: string) => mockApi.import.parseCsv(text),
  });

  const validateMutation = useMutation({
    mutationFn: async (records: Record<string, string>[]) =>
      mockApi.import.validate(records),
  });

  const commitMutation = useMutation({
    mutationFn: async (validRows: CsvPreviewRow[]) => {
      const payload: Trainee[] = validRows.map((r) => ({
        id: "",
        traineeNo: "",
        name: String(r.values.name ?? ""),
        email: String(r.values.email ?? ""),
        phone: String(r.values.phone ?? ""),
        country: (String(r.values.country ?? "Rwanda") || "Rwanda") as Trainee["country"],
        category: String(
          r.values.category ?? "Firefighters",
        ) as Trainee["category"],
        status: "ACTIVE",
        paymentStatus:
          Number(r.values.amountPaid ?? 0) > 0 ? "PARTIAL" : "UNPAID",
        amountPaidRwf: Number(r.values.amountPaid ?? 0),
        totalDueRwf: 0,
        courseId: "",
        enrolledAt: new Date().toISOString(),
        deadline: "",
        attendancePct: 0,
        examScore: null,
        notes: String(r.values.notes ?? ""),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      return mockApi.trainees.importBulk(payload);
    },
    onSuccess: (count) => {
      toast.success("Import complete", {
        description: `${count} trainee${count === 1 ? "" : "s"} added.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["trainees"] });
      setStep("done");
    },
    onError: () => toast.error("The import failed. Nothing was saved."),
  });

  const process = React.useCallback(
    async (text: string, name: string) => {
      setFileName(name);
      setRawText(text);
      const parsed = await parseMutation.mutateAsync(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);

      const records = parsed.rows.map((cells) => {
        const record: Record<string, string> = {};
        parsed.headers.forEach((h, i) => {
          record[h.trim().toLowerCase()] = cells[i] ?? "";
        });
        return record;
      });
      const result = await validateMutation.mutateAsync(records);
      setPreview(result);
      setStep("preview");
    },
    [parseMutation, validateMutation],
  );

  const onFile = React.useCallback(
    async (file: File) => {
      if (!/\.csv$/i.test(file.name)) {
        toast.error("Choose a .csv file.");
        return;
      }
      const text = await file.text();
      await process(text, file.name);
    },
    [process],
  );

  const validRows = React.useMemo(() => preview.filter((r) => r.status === "valid"), [preview]);
  const errorRows = React.useMemo(() => preview.filter((r) => r.status === "error"), [preview]);
  const missingHeaders = REQUIRED_HEADERS.filter(
    (h) => !headers.some((x) => x.trim().toLowerCase() === h),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <DemoBanner>
        CSV import is demo-only: the preview is simulated and committing the rows
        does not write to the database.
      </DemoBanner>

      <PageHeader
        breadcrumbSlot={
          <Link href="/trainees" className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Trainees
          </Link>
        }
        title="Import trainees from CSV"
        subtitle="Upload a spreadsheet, review any problems, then commit the valid rows."
      />

      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {(["upload", "preview", "done"] as const).map((s, i) => {
          const labels = { upload: "1. Upload", preview: "2. Review", done: "3. Done" };
          const state =
            (s === "upload" && step === "upload") ||
            (s === "preview" && step === "preview") ||
            (s === "done" && step === "done")
              ? "current"
              : (i === 0 && step !== "upload") || (i === 1 && step === "done")
                ? "done"
                : "todo";
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium",
                  state === "current" && "bg-navy text-white",
                  state === "done" && "bg-green-bg text-green",
                  state === "todo" && "bg-muted text-ink-2",
                )}
              >
                {labels[s]}
              </span>
              {i < 2 ? <span aria-hidden className="text-ink-3">→</span> : null}
            </li>
          );
        })}
      </ol>

      {step === "upload" ? (
        <>
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Choose a file</CardTitle>
              <CardDescription>
                One row per trainee. Header names are matched case-insensitively.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void onFile(file);
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                  dragging ? "border-orange bg-orange-bg/40" : "border-line bg-paper",
                )}
              >
                <span
                  aria-hidden
                  className="flex size-12 items-center justify-center rounded-xl bg-card text-ink-2 shadow-sm"
                >
                  <UploadCloudIcon className="size-6" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-ink">
                    Drop your CSV here, or browse
                  </p>
                  <p className="text-xs text-ink-2">Maximum file size 5 MB</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onFile(file);
                  }}
                  aria-label="Upload CSV file"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  disabled={parseMutation.isPending}
                >
                  {parseMutation.isPending ? "Reading…" : "Browse files"}
                </Button>
              </div>

              {parseMutation.isPending ? (
                <Progress value={undefined} className="h-1" aria-label="Reading file" />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Expected format</CardTitle>
              <CardDescription>
                Required columns: <code className="font-mono text-xs">name</code>,{" "}
                <code className="font-mono text-xs">email</code>,{" "}
                <code className="font-mono text-xs">course</code> (course code, e.g. FSL1).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="overflow-x-auto rounded-lg border border-line bg-paper p-3 font-mono text-xs text-ink-2">
                {SAMPLE}
              </pre>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const blob = new Blob([SAMPLE], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "trainee-import-template.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <DownloadIcon className="size-3.5" />
                  Download template
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void process(SAMPLE, "sample-template.csv")}
                >
                  Try it with sample data
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {step === "preview" ? (
        <>
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheetIcon className="size-4 text-ink-2" />
                {fileName}
              </CardTitle>
              <CardDescription>
                {preview.length} row{preview.length === 1 ? "" : "s"} ·{" "}
                {validRows.length} valid · {errorRows.length} with errors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {missingHeaders.length > 0 ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>Missing required columns</AlertTitle>
                  <AlertDescription>
                    Your file is missing: {missingHeaders.join(", ")}. Fix the header row
                    and upload again.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2Icon />
                  <AlertDescription>
                    {validRows.length} row{validRows.length === 1 ? "" : "s"} will be
                    imported. Rows with errors are skipped and listed below.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => commitMutation.mutate(validRows)}
                  disabled={
                    missingHeaders.length > 0 ||
                    validRows.length === 0 ||
                    commitMutation.isPending
                  }
                >
                  {commitMutation.isPending
                    ? "Importing…"
                    : `Import ${validRows.length} row${validRows.length === 1 ? "" : "s"}`}
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setStep("upload");
                    setPreview([]);
                    setRawText("");
                    setFileName("");
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  <XIcon className="size-4" />
                  Start over
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue={errorRows.length > 0 ? "errors" : "valid"}>
                <div className="border-b border-line px-4 py-3">
                  <TabsList>
                    <TabsTrigger value="valid">
                      Valid ({validRows.length})
                    </TabsTrigger>
                    <TabsTrigger value="errors">
                      Errors ({errorRows.length})
                    </TabsTrigger>
                    <TabsTrigger value="raw">Raw file</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="valid" className="mt-0">
                  <PreviewTable rows={validRows} headers={headers} />
                </TabsContent>
                <TabsContent value="errors" className="mt-0">
                  {errorRows.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-ink-2">
                      No errors — every row passed validation.
                    </p>
                  ) : (
                    <PreviewTable rows={errorRows} headers={headers} showErrors />
                  )}
                </TabsContent>
                <TabsContent value="raw" className="mt-0">
                  <pre className="max-h-96 overflow-auto p-4 font-mono text-xs whitespace-pre-wrap text-ink-2">
                    {rawText}
                  </pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      ) : null}

      {step === "done" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-green-bg text-green"
            >
              <CheckCircle2Icon className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="font-display text-lg font-semibold text-ink">Import complete</p>
              <p className="text-sm text-ink-2">
                {validRows.length} trainee{validRows.length === 1 ? "" : "s"} added to the
                roster.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/trainees">View trainees</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.refresh()}
                className="gap-1.5"
              >
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step !== "done" ? (
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/trainees">
            <ArrowLeftIcon className="size-4" />
            Back to trainees
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function PreviewTable({
  rows,
  headers,
  showErrors = false,
}: {
  rows: CsvPreviewRow[];
  headers: string[];
  showErrors?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-ink-2">No rows in this tab.</p>
    );
  }
  return (
    <div className="max-h-[28rem] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-14">Row</TableHead>
            {headers.map((h) => (
              <TableHead key={h} className="whitespace-nowrap">
                {h}
              </TableHead>
            ))}
            {showErrors ? <TableHead>Problems</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.rowNumber}
              className={showErrors ? "bg-red-bg/40" : undefined}
            >
              <TableCell className="font-mono text-xs text-ink-2">{r.rowNumber}</TableCell>
              {headers.map((h) => (
                <TableCell key={h} className="max-w-48 truncate text-sm">
                  {r.values[h.trim().toLowerCase()] ?? r.values[h] ?? ""}
                </TableCell>
              ))}
              {showErrors ? (
                <TableCell>
                  <ul className="space-y-0.5">
                    {r.errors.map((err) => (
                      <li key={err} className="text-xs text-red">
                        • {err}
                      </li>
                    ))}
                  </ul>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
