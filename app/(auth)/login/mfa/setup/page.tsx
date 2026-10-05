"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckCircle2Icon, CopyIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api/client";
import { useMfaConfirm, useMfaSetup } from "@/lib/api/hooks";
import { useAuthStore } from "@/lib/stores/auth-store";

const LENGTH = 6;

export default function MfaSetupPage() {
  const router = useRouter();
  const setMfaPassed = useAuthStore((s) => s.setMfaPassed);
  const setupMutation = useMfaSetup();
  const confirmMutation = useMfaConfirm();

  const setup = setupMutation.data ?? null;
  const codes = confirmMutation.data?.recoveryCodes ?? null;
  const [digits, setDigits] = React.useState<string[]>(() => Array(LENGTH).fill(""));
  const [error, setError] = React.useState<string | null>(null);
  const loading = setupMutation.isPending;
  const confirming = confirmMutation.isPending;
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  /* Fetch the secret and QR code on arrival. */
  React.useEffect(() => {
    setupMutation.mutate(undefined, {
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "Could not start setup."),
    });
    /* Runs once on mount; `setupMutation` is stable enough for this intent. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupError = error ?? (setupMutation.isError
    ? setupMutation.error instanceof ApiError
      ? setupMutation.error.message
      : "Could not start setup."
    : null);

  const code = digits.join("");
  const complete = code.length === LENGTH;

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean && value !== "") return;

    setError(null);
    setDigits((prev) => {
      const next = [...prev];
      if (clean.length > 1) {
        clean
          .slice(0, LENGTH - index)
          .split("")
          .forEach((d, i) => {
            next[index + i] = d;
          });
        return next;
      }
      next[index] = clean;
      return next;
    });

    if (clean && index < LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const confirm = () => {
    setError(null);

    confirmMutation.mutate(code, {
      onError: (err) => {
        setError(
          err instanceof ApiError ? err.message : "Could not confirm that code.",
        );
        setDigits(Array(LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      },
    });
  };

  /* ── Recovery codes screen ─────────────────────────────────── */

  if (codes) {
    return (
      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Save your recovery codes
          </h1>
          <p className="text-sm text-ink-2">
            Each code works once if you lose access to your authenticator. This
            is the only time they are shown.
          </p>
        </header>

        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Your codes</CardTitle>
            <CardDescription>Store them somewhere safe and offline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid grid-cols-2 gap-2">
              {codes.map((c) => (
                <li
                  key={c}
                  className="rounded-lg border border-input bg-card px-3 py-2 text-center font-mono text-sm tracking-wide text-ink"
                >
                  {c}
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              className="w-full gap-1.5"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(codes.join("\n"));
                  toast.success("Codes copied to the clipboard.");
                } catch {
                  toast.error("Could not copy — select the codes manually.");
                }
              }}
            >
              <CopyIcon className="size-4" />
              Copy all codes
            </Button>

            <Button
              className="w-full gap-1.5"
              onClick={() => {
                setMfaPassed(true);
                toast.success("Authenticator enabled", {
                  description: "Two-factor authentication is now active.",
                });
                router.replace("/dashboard");
                router.refresh();
              }}
            >
              I have saved them
              <ArrowRightIcon className="size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Enrolment screen ──────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Secure your account
        </h1>
        <p className="text-sm text-ink-2">
          Scan this code with Google Authenticator or Authy, then enter the code
          it shows.
        </p>
      </header>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Set up an authenticator</CardTitle>
          <CardDescription>
            Required on first sign-in before any academy data is visible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <p className="text-sm text-ink-2">Generating your QR code…</p>
            </div>
          ) : setup ? (
            <>
              {/* QR from the authenticator enrolment endpoint — a data: image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qrDataUrl}
                alt="Authenticator enrolment QR code"
                className="mx-auto size-56 rounded-lg border bg-white p-2"
              />

              <details className="text-xs">
                <summary className="cursor-pointer text-ink-2">
                  Can&rsquo;t scan? Enter this key manually
                </summary>
                <p className="mt-2 break-all rounded bg-card p-2 font-mono text-[11px] text-ink">
                  {setup.otpauthUrl}
                </p>
              </details>

              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (complete) void confirm();
                }}
              >
                <fieldset className="space-y-3">
                  <legend className="text-xs font-medium text-ink">
                    Code from your app
                  </legend>
                  <div className="flex justify-between gap-2" role="group">
                    {digits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        value={digit}
                        onChange={(e) => setDigit(index, e.target.value)}
                        onPaste={(e) => {
                          e.preventDefault();
                          setDigit(index, e.clipboardData.getData("text"));
                        }}
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        aria-label={`Digit ${index + 1} of ${LENGTH}`}
                        aria-invalid={Boolean(error)}
                        maxLength={LENGTH}
                        className="h-12 w-full rounded-lg border border-input bg-card text-center font-mono text-lg font-medium text-ink focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
                      />
                    ))}
                  </div>
                </fieldset>

                {error ? (
                  <p role="alert" className="text-xs text-red">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  className="w-full gap-1.5"
                  disabled={!complete || confirming}
                >
                  {confirming ? "Confirming…" : "Confirm and continue"}
                  <ArrowRightIcon className="size-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="space-y-3 py-4">
              <Alert variant="destructive">
                <AlertDescription>
                  {setupError ?? "Could not start setup."}
                </AlertDescription>
              </Alert>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <ShieldCheckIcon className="size-4" />
        <AlertDescription className="text-xs">
          <span className="font-medium text-ink">How this works</span>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Your phone generates a new code every 30 seconds.</li>
            <li>Codes work offline — no SMS, no email codes.</li>
            <li>You also get ten single-use recovery codes.</li>
          </ul>
        </AlertDescription>
      </Alert>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
        <CheckCircle2Icon className="size-3" />
        Your password alone never reaches academy data.
      </p>
    </div>
  );
}
