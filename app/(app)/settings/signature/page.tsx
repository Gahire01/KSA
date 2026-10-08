"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderIcon, LockIcon, Redo2Icon, Trash2Icon, Undo2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDateTime } from "@/lib/utils/format";

/**
 * /settings/signature — owner only. Draw or upload, save as a draft, then
 * explicitly lock. Locking is the only step that changes what future
 * certificates print; earlier certificates keep their own snapshot.
 */

interface SignatureRow {
  id: string;
  imageUrl: string;
  signerName: string;
  signerTitle: string;
  source: "DRAWN" | "UPLOADED";
  isActive: boolean;
  lockedAt: string | null;
  createdAt: string;
}

/** Canvas is 1400x400 internally and shown at 700x200: a 2x retina export. */
const CANVAS_W = 1400;
const CANVAS_H = 400;
/**
 * The 1400x400 drawing is printed about 60px tall (a 0.15 scale), so a stroke has
 * to be ~20-26 canvas px to land at 3-4px on the certificate. The old 2-8px stroke
 * printed as a hairline.
 */
const STROKE_BASE = 20;
const MAX_UPLOAD = 2 * 1024 * 1024;

type Point = { x: number; y: number; p: number };
type Stroke = Point[];

function SignaturePad({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const [redo, setRedo] = React.useState<Stroke[]>([]);
  const current = React.useRef<Stroke | null>(null);

  const paint = React.useCallback((all: Stroke[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0F2340";
    for (const stroke of all) {
      if (stroke.length === 1) {
        const a = stroke[0];
        ctx.beginPath();
        ctx.arc(a.x, a.y, STROKE_BASE / 2 + a.p * 3, 0, Math.PI * 2);
        ctx.fillStyle = "#0F2340";
        ctx.fill();
        continue;
      }
      for (let i = 1; i < stroke.length; i += 1) {
        const a = stroke[i - 1];
        const b = stroke[i];
        ctx.beginPath();
        ctx.lineWidth = STROKE_BASE + ((a.p + b.p) / 2) * 6;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }, []);

  React.useEffect(() => {
    paint(strokes);
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (strokes.length === 0) {
      onChange(null);
      return;
    }
    /* Transparent background: the canvas is never filled, only stroked. */
    canvas.toBlob((blob) => onChange(blob), "image/png");
  }, [strokes, paint, onChange]);

  function toPoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
      /* Mice report 0.5 while pressed; pens report real pressure. */
      p: event.pressure > 0 ? event.pressure : 0.5,
    };
  }

  function onDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    current.current = [toPoint(event)];
    paint([...strokes, current.current]);
  }

  function onMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!current.current) return;
    current.current.push(toPoint(event));
    paint([...strokes, current.current]);
  }

  function onUp() {
    if (!current.current) return;
    const finished = current.current;
    current.current = null;
    setStrokes((s) => [...s, finished]);
    setRedo([]);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block h-auto w-full max-w-[700px] cursor-crosshair touch-none"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Signature drawing area"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={strokes.length === 0}
          onClick={() => {
            setRedo((r) => [...r, strokes[strokes.length - 1]]);
            setStrokes((s) => s.slice(0, -1));
          }}
        >
          <Undo2Icon className="size-4" /> Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={redo.length === 0}
          onClick={() => {
            setStrokes((s) => [...s, redo[redo.length - 1]]);
            setRedo((r) => r.slice(0, -1));
          }}
        >
          <Redo2Icon className="size-4" /> Redo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={strokes.length === 0}
          onClick={() => {
            setStrokes([]);
            setRedo([]);
          }}
        >
          <Trash2Icon className="size-4" /> Clear
        </Button>
      </div>
    </div>
  );
}

export default function SignatureSettingsPage() {
  const queryClient = useQueryClient();
  const isOwner = useAuthStore((s) => s.currentUser?.role) === "OWNER";

  const [tab, setTab] = React.useState<"DRAWN" | "UPLOADED">("DRAWN");
  const [drawn, setDrawn] = React.useState<Blob | null>(null);
  const [uploaded, setUploaded] = React.useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = React.useState<string | null>(null);
  const [signerName, setSignerName] = React.useState("");
  const [signerTitle, setSignerTitle] = React.useState("");
  const [draft, setDraft] = React.useState<SignatureRow | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);

  const list = useQuery({
    queryKey: ["signature"],
    queryFn: () => api.get<{ active: SignatureRow | null; items: SignatureRow[] }>("/signature"),
    enabled: isOwner,
  });

  React.useEffect(() => {
    if (!uploaded) {
      setUploadPreview(null);
      return;
    }
    const url = URL.createObjectURL(uploaded);
    setUploadPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [uploaded]);

  const save = useMutation({
    mutationFn: async () => {
      const blob = tab === "DRAWN" ? drawn : uploaded;
      if (!blob) throw new Error(tab === "DRAWN" ? "Draw your signature first." : "Choose a PNG first.");
      const form = new FormData();
      form.set("file", blob, "signature.png");
      form.set("signerName", signerName);
      form.set("signerTitle", signerTitle);
      form.set("source", tab);
      return api.postForm<SignatureRow>("/signature/upload", form);
    },
    onSuccess: (row) => {
      setDraft(row);
      setConfirmed(false);
      void queryClient.invalidateQueries({ queryKey: ["signature"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const lock = useMutation({
    mutationFn: (id: string) => api.post<SignatureRow>("/signature/lock", { id, confirm: true }),
    onSuccess: () => {
      toast.success("Signature locked. New certificates will use it.");
      setDraft(null);
      setConfirmed(false);
      void queryClient.invalidateQueries({ queryKey: ["signature"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_UPLOAD) {
      toast.error("The image is larger than 2 MB.");
      return;
    }
    if (file.type !== "image/png") {
      toast.error("Only PNG images are accepted.");
      return;
    }
    setUploaded(file);
  }

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <PageHeader title="Signature" description="Only the owner can manage the certificate signature." />
      </div>
    );
  }

  const active = list.data?.active ?? null;
  const ready = signerName.trim().length >= 2 && signerTitle.trim().length >= 2;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificate signature"
        description="Draw or upload the signature printed on every certificate, then lock it."
      />

      <Card>
        <CardHeader>
          <CardTitle>Active signature</CardTitle>
          <CardDescription>Used for every certificate issued from now on.</CardDescription>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <Skeleton className="h-16 w-64" />
          ) : active ? (
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- own API, no optimiser */}
              <img src={active.imageUrl} alt="Active signature" className="max-h-[60px] max-w-[180px] object-contain" />
              <div>
                <p className="font-medium">{active.signerName}</p>
                <p className="text-sm text-ink-2">{active.signerTitle}</p>
                {active.lockedAt ? (
                  <p className="text-xs text-ink-2">Locked {formatDateTime(active.lockedAt)}</p>
                ) : null}
              </div>
              <Badge>Active</Badge>
            </div>
          ) : (
            <p className="text-sm text-ink-2">
              No signature is locked yet. Certificates will print a plain signature line until you lock one.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New signature</CardTitle>
          <CardDescription>Saved as a draft first. Nothing changes until you lock it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="signerName">Signer name</Label>
              <Input id="signerName" value={signerName} maxLength={80} onChange={(e) => setSignerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signerTitle">Signer title</Label>
              <Input id="signerTitle" value={signerTitle} maxLength={80} onChange={(e) => setSignerTitle(e.target.value)} />
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "DRAWN" | "UPLOADED")}>
            <TabsList>
              <TabsTrigger value="DRAWN">Draw</TabsTrigger>
              <TabsTrigger value="UPLOADED">Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="DRAWN" className="pt-4">
              <SignaturePad onChange={setDrawn} />
            </TabsContent>
            <TabsContent value="UPLOADED" className="space-y-3 pt-4">
              <label
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files[0]);
                }}
              >
                <UploadIcon className="size-5" />
                Drag a PNG here or click to choose (max 2 MB)
                <input
                  type="file"
                  accept="image/png"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
              {uploadPreview ? (
                <div className="rounded-lg border border-line bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  <img src={uploadPreview} alt="Upload preview" className="max-h-[60px] max-w-[180px] object-contain" />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>

          <Button
            type="button"
            disabled={!ready || save.isPending || (tab === "DRAWN" ? !drawn : !uploaded)}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <LoaderIcon className="size-4 animate-spin" /> : null}
            Save as draft
          </Button>
        </CardContent>
      </Card>

      {draft ? (
        <Card className="border-amber-400">
          <CardHeader>
            <CardTitle>Lock this signature</CardTitle>
            <CardDescription>
              You are about to lock this signature. It will appear on every certificate issued from now on.
              Previous certificates keep their original signature. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg border border-line bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- own API, no optimiser */}
              <img src={draft.imageUrl} alt="Draft signature" className="max-h-[60px] max-w-[180px] object-contain" />
              <div className="text-sm">
                <p className="font-medium">{draft.signerName}</p>
                <p className="text-ink-2">{draft.signerTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
              />
              <Label htmlFor="confirm">I confirm this is the correct signature</Label>
            </div>
            <Button type="button" disabled={!confirmed || lock.isPending} onClick={() => lock.mutate(draft.id)}>
              {lock.isPending ? <LoaderIcon className="size-4 animate-spin" /> : <LockIcon className="size-4" />}
              Lock and activate
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
