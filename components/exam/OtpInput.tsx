"use client";

import * as React from "react";
import { AlertCircleIcon, LoaderIcon, MailIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/**
 * Six-box one-time-code entry.
 *
 * Auto-advances, fills from a paste, submits on the sixth digit, and on failure
 * clears and refocuses the first box.
 *
 * Deliberately renders the same markup whether or not the token behind it is
 * real — the parent only ever learns "verified" or the generic failure, so this
 * component cannot become an existence oracle for exam tokens.
 */

export const OTP_LENGTH = 6;

export function OtpInput({
  onSubmit,
  onResend,
  disabled,
  error,
  busy,
  resendBusy,
  secondsLeft,
}: {
  onSubmit: (code: string) => void;
  onResend: () => void;
  disabled?: boolean;
  error: string | null;
  busy: boolean;
  resendBusy: boolean;
  /** Countdown to the code's expiry; null hides the timer. */
  secondsLeft: number | null;
}) {
  const [digits, setDigits] = React.useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [focused, setFocused] = React.useState(0);
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const submitted = React.useRef(false);

  /* Clear + refocus whenever a fresh error arrives. */
  React.useEffect(() => {
    if (!error) return;
    submitted.current = false;
    setDigits(Array(OTP_LENGTH).fill(""));
    setFocused(0);
    refs.current[0]?.focus();
  }, [error]);

  const code = digits.join("");

  const setDigit = (index: number, value: string) => {
    /* Only digits ever enter state, so the joined code is always valid. */
    const clean = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = prev.slice();
      next[index] = clean;
      return next;
    });
    if (clean) {
      /* Move the caret for real. Tracking the index in state only recolours the
       * box; without the imperative focus the next keystroke would land back in
       * the box just typed into. */
      const target = Math.min(OTP_LENGTH - 1, index + 1);
      setFocused(target);
      refs.current[target]?.focus();
    }
  };

  const handleChange = (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;

    /* A paste of the whole code lands on one box. */
    const pasted = raw.replace(/\D/g, "");
    if (pasted.length > 1) {
      fillAll(pasted);
      return;
    }

    setDigit(index, raw);
  };

  const fillAll = (value: string) => {
    const chars = value.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
    const next = Array(OTP_LENGTH).fill("").map((_, i) => chars[i] ?? "");
    setDigits(next);
    setFocused(Math.min(chars.length, OTP_LENGTH - 1));
    refs.current[Math.min(chars.length, OTP_LENGTH - 1)]?.focus();
    if (next.every((d) => d !== "")) {
      submitted.current = true;
      onSubmit(next.join(""));
    }
  };

  const handleKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      setDigits((prev) => {
        const next = prev.slice();
        if (next[index]) {
          next[index] = "";
        } else if (index > 0) {
          next[index - 1] = "";
          setFocused(index - 1);
          refs.current[index - 1]?.focus();
        }
        return next;
      });
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      setFocused(index - 1);
      refs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      setFocused(index + 1);
      refs.current[index + 1]?.focus();
    }
  };

  /* Auto-submit on the sixth digit. `submitted` guards against a second submit
   * while the request is still in flight. */
  React.useEffect(() => {
    if (code.length !== OTP_LENGTH || submitted.current || busy || disabled) return;
    submitted.current = true;
    onSubmit(code);
  }, [code, busy, disabled, onSubmit]);

  const mm = secondsLeft === null ? "--" : String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = secondsLeft === null ? "--" : String(secondsLeft % 60).padStart(2, "0");
  const expired = secondsLeft !== null && secondsLeft <= 0;

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="space-y-1.5 text-center">
          <h1 className="font-display text-xl font-semibold text-ink">
            Enter the 6-digit code we emailed you
          </h1>
          <p className="text-sm text-ink-2">
            We send a new code each time. It expires in 30 minutes.
          </p>
        </div>

        {secondsLeft !== null ? (
          <p
            className={cn(
              "text-center font-mono text-sm tabular",
              expired ? "text-red" : "text-ink-2",
            )}
            aria-live="polite"
          >
            {expired ? "Code expired" : `Expires in ${mm}:${ss}`}
          </p>
        ) : null}

        <div
          className="flex justify-center gap-2"
          role="group"
          aria-label={`${OTP_LENGTH}-digit code`}
        >
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                refs.current[index] = el;
              }}
              value={digit}
              onChange={handleChange(index)}
              onKeyDown={handleKeyDown(index)}
              onFocus={() => setFocused(index)}
              disabled={disabled || busy}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              pattern="[0-9]*"
              maxLength={1}
              aria-label={`Digit ${index + 1}`}
              aria-invalid={Boolean(error)}
              className={cn(
                "size-12 rounded-lg border text-center font-mono text-xl font-semibold text-ink transition-colors",
                "focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-60",
                error
                  ? "border-red"
                  : focused === index
                    ? "border-orange"
                    : "border-line",
              )}
              style={{ WebkitBoxShadow: "none" }}
              onClick={() => {
                setFocused(index);
                refs.current[index]?.select();
              }}
            />
          ))}
        </div>

        {error ? (
          <p
            role="alert"
            className="flex items-center justify-center gap-1.5 text-sm text-red"
          >
            <AlertCircleIcon className="size-4" />
            {error}
          </p>
        ) : null}

        {busy ? (
          <p className="flex items-center justify-center gap-2 text-sm text-ink-2">
            <LoaderIcon className="size-4 animate-spin" />
            Checking your code…
          </p>
        ) : null}

        <div className="flex flex-col items-center gap-2 border-t border-line pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onResend}
            disabled={resendBusy || busy || expired}
            className="gap-1.5"
          >
            <MailIcon className="size-4" />
            {resendBusy ? "Sending…" : "Didn't receive it? Resend code"}
          </Button>
          {expired ? (
            <p className="text-xs text-ink-3">
              Resend to get a new code for this exam.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}