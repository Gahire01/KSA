"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { api } from "@/lib/api/client";

export function ManualCertificateForm({ courses }: { courses: Array<{ id: string; name: string; code: string }> }) {
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [certificate, setCertificate] = useState<{ id: string; studentNumber: number } | null>(null);
  const queryClient = useQueryClient();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || certificate) return;
    const values = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await api.post<{ certificate: { id: string; studentNumber: number }; pdfReady: boolean }>("/certificates/manual", {
        traineeName: values.get("traineeName"), courseId: values.get("courseId"),
        traineeId: values.get("traineeId"), issuedOn: values.get("issuedOn"), password,
      });
      setCertificate(result.certificate);
      await queryClient.invalidateQueries({ queryKey: ["certificates"] });
      toast.success(result.pdfReady ? "Certificate issued. Your PDF is ready." : "Certificate issued. Use Download PDF to retry PDF generation.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not issue certificate."); }
    finally { setPassword(""); setBusy(false); }
  }
  return <div className="mx-auto max-w-2xl space-y-6">
    <PageHeader title="Issue certificate" subtitle="Issue a certificate without an exam. Your password is required to confirm." />
    {certificate ? <Card><CardContent className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">Certificate #{certificate.studentNumber} issued</h2>
      <Button asChild size="lg"><a href={`/api/certificates/${certificate.id}/pdf`} download>Download PDF</a></Button>
      <p><Link href="/certificates" className="underline">Back to certificates</Link></p>
    </CardContent></Card> : <Card><CardContent className="p-6"><form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="traineeName">Trainee Name</Label><Input id="traineeName" name="traineeName" required minLength={2} maxLength={160} disabled={busy} /></div>
      <div className="space-y-2"><Label htmlFor="courseId">Course</Label><select id="courseId" name="courseId" required disabled={busy} className="h-10 w-full rounded-md border border-line bg-card px-3 text-sm"><option value="">Select a course</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="issuedOn">Issue Date</Label><Input id="issuedOn" name="issuedOn" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} disabled={busy} /></div>
      <div className="space-y-2"><Label htmlFor="traineeId">Trainee ID (optional)</Label><Input id="traineeId" name="traineeId" maxLength={128} disabled={busy} /><p className="text-sm text-ink-2">Enter an existing trainee ID or enrolment number. Leave blank to create a trainee record for this certificate.</p></div>
      <div className="space-y-2"><Label htmlFor="adminPassword">Admin Password</Label><Input id="adminPassword" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={1024} disabled={busy} /></div>
      <div className="flex gap-3"><Button type="submit" disabled={busy || !courses.length}>{busy ? "Issuing certificate…" : "Issue certificate"}</Button><Button asChild variant="outline"><Link href="/certificates">Cancel</Link></Button></div>
    </form></CardContent></Card>}
  </div>;
}
