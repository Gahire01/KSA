"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { DownloadIcon, LoaderIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { SAMPLE_CSV } from "@/lib/exams/import-sample";

/**
 * /exams/[id]/import — bulk question upload for one course (an "exam" is a
 * course: the paper is drawn from the course's question bank).
 *
 * Three ways in (paste CSV, upload CSV, upload .xlsx), always a preview first.
 * Nothing is written until "Import" is pressed, and the import is one
 * transaction.
 */

interface Preview {
  total: number;
  valid: number;
  invalid: number;
  errors: Array<{ row: number; message: string }>;
  errorsTruncated: boolean;
  preview?: Array<{
    row: number;
    text: string;
    difficulty: number;
    options: Array<{ text: string; isCorrect: boolean }>;
  }>;
  imported?: number;
}

type Source = { kind: "text"; text: string } | { kind: "file"; file: File };

function buildForm(courseId: string, source: Source, mode: "preview" | "commit"): FormData {
  const form = new FormData();
  form.set("courseId", courseId);
  form.set("mode", mode);
  if (source.kind === "text") form.set("text", source.text);
  else form.set("file", source.file);
  return form;
}

export default function ImportQuestionsPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const [tab, setTab] = React.useState<"paste" | "csv" | "xlsx">("paste");
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<Preview | null>(null);

  const source: Source | null =
    tab === "paste" ? (text.trim() ? { kind: "text", text } : null) : file ? { kind: "file", file } : null;

  const preview = useMutation({
    mutationFn: (s: Source) => api.postForm<Preview>("/questions/import", buildForm(courseId, s, "preview")),
    onSuccess: setResult,
    onError: (error: Error) => {
      setResult(null);
      toast.error(error.message);
    },
  });

  const commit = useMutation({
    mutationFn: (s: Source) => api.postForm<Preview>("/questions/import", buildForm(courseId, s, "commit")),
    onSuccess: (data) => {
      setResult(data);
      toast.success(`${data.imported ?? 0} questions imported`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function downloadSample() {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "ksa-questions-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const imported = result?.imported !== undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import questions"
        description="Add many questions at once from a CSV or Excel file. You will see a preview before anything is saved."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/exams/${courseId}`}>Back</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Provide the questions</CardTitle>
          <CardDescription>
            Columns: question, option_a, option_b, option_c, option_d, correct (a-d or 1-4), difficulty (1-3,
            optional), explanation (optional). Up to 5,000 rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" size="sm" onClick={downloadSample}>
            <DownloadIcon className="size-4" /> Download sample CSV
          </Button>

          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as typeof tab);
              setResult(null);
            }}
          >
            <TabsList>
              <TabsTrigger value="paste">Paste CSV</TabsTrigger>
              <TabsTrigger value="csv">Upload CSV</TabsTrigger>
              <TabsTrigger value="xlsx">Upload Excel</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="pt-3">
              <Textarea
                rows={8}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setResult(null);
                }}
                placeholder="question,option_a,option_b,option_c,option_d,correct,difficulty,explanation"
                className="font-mono text-xs"
              />
            </TabsContent>
            {(["csv", "xlsx"] as const).map((kind) => (
              <TabsContent key={kind} value={kind} className="pt-3">
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-2">
                  <UploadIcon className="size-5" />
                  {file && tab === kind ? file.name : `Choose a ${kind === "csv" ? ".csv" : ".xlsx"} file (max 5 MB)`}
                  <input
                    type="file"
                    accept={kind === "csv" ? ".csv,text/csv" : ".xlsx"}
                    className="sr-only"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setResult(null);
                    }}
                  />
                </label>
              </TabsContent>
            ))}
          </Tabs>

          <Button type="button" disabled={!source || preview.isPending} onClick={() => source && preview.mutate(source)}>
            {preview.isPending ? <LoaderIcon className="size-4 animate-spin" /> : null}
            Preview
          </Button>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Check the result</CardTitle>
            <CardDescription>
              {imported
                ? `${result.imported} imported.`
                : `${result.valid} valid, ${result.invalid} invalid.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.preview && result.preview.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-ink-2">
                    <tr>
                      <th className="py-1 pr-3">Row</th>
                      <th className="py-1 pr-3">Question</th>
                      <th className="py-1 pr-3">Options</th>
                      <th className="py-1">Diff.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {result.preview.map((q) => (
                      <tr key={q.row}>
                        <td className="py-1.5 pr-3">{q.row}</td>
                        <td className="py-1.5 pr-3">{q.text}</td>
                        <td className="py-1.5 pr-3">
                          {q.options.map((o, i) => (
                            <span key={i} className="mr-2 inline-block">
                              {o.text}
                              {o.isCorrect ? " ✓" : ""}
                            </span>
                          ))}
                        </td>
                        <td className="py-1.5">{q.difficulty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-xs text-ink-2">Showing the first {result.preview.length} valid rows.</p>
              </div>
            ) : null}

            {result.errors.length > 0 ? (
              <Alert variant="destructive">
                <AlertDescription>
                  <p className="font-medium">{result.invalid} row{result.invalid === 1 ? "" : "s"} will be skipped</p>
                  <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs">
                    {result.errors.map((e, i) => (
                      <li key={i}>
                        <Badge variant="red" className="mr-1">Row {e.row}</Badge>
                        {e.message}
                      </li>
                    ))}
                  </ul>
                  {result.errorsTruncated ? <p className="mt-1 text-xs">Only the first 200 are listed.</p> : null}
                </AlertDescription>
              </Alert>
            ) : null}

            {!imported ? (
              <Button
                type="button"
                disabled={result.valid === 0 || commit.isPending}
                onClick={() => source && commit.mutate(source)}
              >
                {commit.isPending ? <LoaderIcon className="size-4 animate-spin" /> : null}
                Import {result.valid} valid question{result.valid === 1 ? "" : "s"}
                {result.invalid > 0 ? ` (skip ${result.invalid})` : ""}
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`/exams/${courseId}`}>Done</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
