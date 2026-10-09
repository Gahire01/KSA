"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, CheckCircle2Icon, DownloadIcon, FileSpreadsheetIcon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

/**
 * /trainees/import — bulk enrolment from a CSV. The file is checked on the server
 * (preview first, nothing written), then the valid rows are created. Rows with
 * problems are listed and skipped, never guessed at.
 */

interface PreviewRow {
  row: number;
  values: Record<string, string>;
  errors: string[];
  status: "valid" | "error";
}

interface ImportResult {
  total: number;
  valid: number;
  invalid: number;
  rows: PreviewRow[];
  rowsTruncated: boolean;
  imported?: number;
}

type Step = "upload" | "preview" | "done";

/* Columns only: the academy fills in its own people. */
const TEMPLATE = "name,email,phone,country,category,course,amountPaid\n";

export default function ImportTraineesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = React.useState<Step>("upload");
  const [fileName, setFileName] = React.useState("");
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const preview = useMutation({
    mutationFn: (csv: string) => api.post<ImportResult>("/trainees/import", { text: csv, mode: "preview" }),
    onSuccess: (data) => {
      setResult(data);
      setStep("preview");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const commit = useMutation({
    mutationFn: () => api.post<ImportResult>("/trainees/import", { text, mode: "commit" }),
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
      toast.success("Import complete", { description: `${data.imported ?? 0} trainees added.` });
      void queryClient.invalidateQueries({ queryKey: ["trainees"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message || "The import failed."),
  });

  const onFile = React.useCallback(
    async (file: File) => {
      if (!/\.csv$/i.test(file.name)) {
        toast.error("Choose a .csv file.");
        return;
      }
      const content = await file.text();
      setFileName(file.name);
      setText(content);
      preview.mutate(content);
    },
    [preview],
  );

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "ksa-trainees-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const problems = (result?.rows ?? []).filter((r) => r.status === "error");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        breadcrumbSlot={
          <Link href="/trainees" className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Trainees
          </Link>
        }
        title="Import trainees from CSV"
        subtitle="Upload a spreadsheet, review any problems, then add the valid rows."
      />

      {step === "upload" ? (
        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Choose a file</CardTitle>
            <CardDescription>
              Columns: name, email, course (a course code or name) are required; phone, country, category and
              amountPaid are optional but phone must be valid. One row per trainee.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
              <DownloadIcon className="size-4" />
              Download the column template
            </Button>
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
              <span aria-hidden className="flex size-12 items-center justify-center rounded-xl bg-card text-ink-2 shadow-sm">
                <UploadCloudIcon className="size-6" />
              </span>
              <p className="text-sm font-medium text-ink">Drop your CSV here, or browse</p>
              <p className="text-xs text-ink-2">Maximum file size 5 MB</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
              <Button type="button" size="sm" disabled={preview.isPending} onClick={() => inputRef.current?.click()}>
                {preview.isPending ? "Checking…" : "Browse files"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "preview" && result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Rows in file" value={result.total} />
            <Stat label="Ready to import" value={result.valid} tone="green" />
            <Stat label="Need fixing" value={result.invalid} tone={result.invalid > 0 ? "red" : undefined} />
          </div>

          {problems.length > 0 ? (
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertTitle>
                {problems.length} row{problems.length === 1 ? "" : "s"} will be skipped
              </AlertTitle>
              <AlertDescription>Fix them in the file and upload again, or import the valid rows now.</AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheetIcon className="size-4 text-ink-2" />
                {fileName}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[28rem] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-14">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell className="tabular text-ink-3">{r.row}</TableCell>
                        <TableCell className="text-sm text-ink">{r.values.name}</TableCell>
                        <TableCell className="text-sm text-ink-2">{r.values.email}</TableCell>
                        <TableCell className="text-sm text-ink-2">{r.values.course}</TableCell>
                        <TableCell>
                          {r.status === "valid" ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-green">
                              <CheckCircle2Icon className="size-3.5" /> Ready
                            </span>
                          ) : (
                            <ul className="space-y-0.5 text-xs text-red">
                              {r.errors.map((e) => (
                                <li key={e}>{e}</li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {result.rowsTruncated ? (
                <p className="border-t border-line px-4 py-2 text-xs text-ink-3">Showing the first 300 rows.</p>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button disabled={result.valid === 0 || commit.isPending} onClick={() => commit.mutate()}>
              {commit.isPending ? "Importing…" : `Import ${result.valid} trainee${result.valid === 1 ? "" : "s"}`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep("upload");
                setResult(null);
              }}
            >
              Choose another file
            </Button>
          </div>
        </>
      ) : null}

      {step === "done" && result ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-green-bg text-green" aria-hidden>
              <CheckCircle2Icon className="size-6" />
            </span>
            <p className="font-display text-lg font-semibold text-ink">{result.imported ?? 0} trainees added</p>
            {result.invalid > 0 ? (
              <p className="text-sm text-ink-2">{result.invalid} rows were skipped because of problems.</p>
            ) : null}
            <Button onClick={() => router.push("/trainees")}>View trainees</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold tracking-wider text-ink-2 uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-2xl font-semibold tabular",
          tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
