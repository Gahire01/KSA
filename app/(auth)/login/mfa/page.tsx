"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api/client";
import { useMfaVerify } from "@/lib/api/hooks";
import type { MfaVerifyDTO } from "@/lib/api/types";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils/cn";

const LENGTH = 6;

export default function MfaPage() {
  const router = useRouter();
  const setMfaPassed = useAuthStore((s) => s.setMfaPassed);
  const verify = useMfaVerify();
  const checking = verify.isPending;

  const [digits, setDigits] = React.useState<string[]>(() => Array(LENGTH).fill(""));
  const [error, setError] = React.useState<string | null>(null);
  const [showRecovery, setShowRecovery] = React.useState(false);
  const [recovery, setRecovery] = React.useState("");
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join("");
  const complete = code.length === LENGTH;

  const finish = React.useCallback(
    (result: MfaVerifyDTO) => {
      setMfaPassed(true);
      toast.success("Signed in", {
        description:
          result.via === "recovery"
            ? "Signed in with a recovery code."
            : "Two-factor confirmed.",
      });
      router.replace("/dashboard");
      router.refresh();
    },
    [router, setMfaPassed],
  );

  const submit = React.useCallback(
    (value: string) => {
      setError(null);

      verify.mutate(value.trim(), {
        onSuccess: finish,
        onError: (err) => {
          setError(
            err instanceof ApiError ? err.message : "Could not verify that code.",
          );
          setDigits(Array(LENGTH).fill(""));
          inputRefs.current[0]?.focus();
        },
      });
    },
    [finish, verify],
  );

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean && value !== "") return;

    setError(null);
    setDigits((prev) => {
      const next = [...prev];
      if (clean.length > 1) {
        /* Pasted or autofilled: distribute across the boxes. */
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

    if (clean && index < LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  /* Auto-submit once all six digits are in — matches the previous behaviour. */
  const submittedRef = React.useRef(false);
  React.useEffect(() => {
    /* Re-arm once the previous attempt settles, so a retry can auto-submit. */
    if (!checking) submittedRef.current = false;
  }, [checking]);

  React.useEffect(() => {
    if (!complete || checking || submittedRef.current) return;
    submittedRef.current = true;
    submit(code);
  }, [complete, checking, code, submit]);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Enter your code
        </h1>
        <p className="text-sm text-ink-2">
          Open your authenticator app and enter the six-digit code for this site.
        </p>
      </header>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Two-factor confirmation</CardTitle>
          <CardDescription>Codes refresh every 30 seconds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (complete) void submit(code);
            }}
          >
            <fieldset className="space-y-3" disabled={showRecovery}>
              <legend className="sr-only">Six-digit verification code</legend>
              <div className="flex justify-between gap-2" role="group">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    value={digit}
                    onChange={(e) => setDigit(index, e.target.value)}
                    onKeyDown={(e) => onKeyDown(index, e)}
                    onPaste={(e) => {
                      e.preventDefault();
                      setDigit(index, e.clipboardData.getData("text"));
                    }}
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    aria-label={`Digit ${index + 1} of ${LENGTH}`}
                    aria-invalid={Boolean(error)}
                    maxLength={LENGTH}
                    className={cn(
                      "h-12 w-full rounded-lg border bg-card text-center font-mono text-lg font-medium text-ink transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
                      error ? "border-red" : "border-input",
                    )}
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
              className="mt-4 w-full gap-1.5"
              disabled={!complete || checking || showRecovery}
            >
              {checking ? "Verifying…" : "Verify and continue"}
              <ArrowRightIcon className="size-4" />
            </Button>
          </form>

          {showRecovery ? (
            <form
              className="space-y-3 border-t pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(recovery);
              }}
            >
              <label className="text-xs font-medium text-ink" htmlFor="recovery">
                Recovery code
              </label>
              <input
                id="recovery"
                value={recovery}
                onChange={(e) => setRecovery(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                autoComplete="one-time-code"
                className="h-10 w-full rounded-lg border border-input bg-card px-3 font-mono text-sm text-ink focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
              />
              <p className="text-xs text-ink-2">
                Each recovery code works once. Using one signs you in immediately.
              </p>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link href="/login">
            <ArrowLeftIcon className="size-4" />
            Use a different account
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setShowRecovery((v) => !v);
            setError(null);
          }}
        >
          <KeyRoundIcon className="size-3.5" />
          {showRecovery ? "Use authenticator" : "Use a recovery code"}
        </Button>
      </div>

      <Alert>
        <AlertDescription className="text-xs">
          Lost your device? Use one of the recovery codes you saved when you first
          enrolled your authenticator.
        </AlertDescription>
      </Alert>
    </div>
  );
}
