"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils/cn";

const LENGTH = 6;
const RESEND_SECONDS = 30;

export default function MfaPage() {
  const router = useRouter();
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const verifyMfa = useAuthStore((s) => s.verifyMfa);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [digits, setDigits] = React.useState<string[]>(() => Array(LENGTH).fill(""));
  const [error, setError] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(RESEND_SECONDS);
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  /* No email in flight → send the visitor back to step one. */
  React.useEffect(() => {
    if (!pendingEmail) router.replace("/login");
  }, [pendingEmail, router]);

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const code = digits.join("");
  const complete = code.length === LENGTH;

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

  const submit = React.useCallback(
    (value: string) => {
      /* Any 6 digits are accepted in this mock. */
      if (value.length !== LENGTH) {
        setError("Enter all six digits.");
        return;
      }
      verifyMfa();
      toast.success("Signed in", {
        description: `Welcome back${
          currentUser ? `, ${currentUser.name.split(" ")[0]}` : ""
        }.`,
      });
      router.replace("/dashboard");
    },
    [verifyMfa, currentUser, router],
  );

  React.useEffect(() => {
    if (complete) submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Enter your code
        </h1>
        <p className="text-sm text-ink-2">
          We sent a six-digit code to{" "}
          <span className="font-medium text-ink">{pendingEmail ?? "your email"}</span>.
        </p>
      </header>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">One-time code</CardTitle>
          <CardDescription>
            Codes expire after 10 minutes. In this demo any six digits work.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(code);
            }}
          >
            <fieldset className="space-y-3">
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

            <Button type="submit" className="mt-4 w-full gap-1.5" disabled={!complete}>
              Verify and continue
              <ArrowRightIcon className="size-4" />
            </Button>
          </form>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-2">
              <span>Code expires in 10:00</span>
              <span className="tabular">
                Resend in {secondsLeft > 0 ? `0:${String(secondsLeft).padStart(2, "0")}` : "0:00"}
              </span>
            </div>
            <Progress value={(secondsLeft / RESEND_SECONDS) * 100} className="h-1" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link href="/login">
            <ArrowLeftIcon className="size-4" />
            Use a different email
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={secondsLeft > 0}
          onClick={() => {
            setSecondsLeft(RESEND_SECONDS);
            setDigits(Array(LENGTH).fill(""));
            setError(null);
            toast("New code sent", { description: "Check your inbox for the fresh code." });
          }}
        >
          <RotateCcwIcon className="size-3.5" />
          Resend code
        </Button>
      </div>

      <Alert>
        <AlertDescription className="text-xs">
          Trouble signing in? Contact the academy administrator at{" "}
          <span className="font-mono">+250 788 000 000</span>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
