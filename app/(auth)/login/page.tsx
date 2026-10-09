"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, MailIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { AccessEntry } from "@/components/auth/AccessEntry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { useLogin, useLoginResend, useLoginVerify } from "@/lib/api/hooks";
import { cn } from "@/lib/utils/cn";

const schema = z.object({
  email: z
    .string()
    .min(1, "Enter your work email.")
    .email("That does not look like an email address."),
  password: z.string().min(1, "Enter your password."),
});

type Values = z.infer<typeof schema>;

const LENGTH = 6;
/** How long a code lives, and how long the page counts down for. */
const CODE_TTL_SECONDS = 10 * 60;
/** Client-side mirror of the server's resend cooldown. */
const RESEND_COOLDOWN_SECONDS = 60;
/** Where the address waiting for a code survives a refresh. */
const PENDING_EMAIL_KEY = "ksa:login:pending-email";

type Phase = "credentials" | "code";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const verify = useLoginVerify();
  const resend = useLoginResend();

  const [phase, setPhase] = React.useState<Phase>("credentials");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState<string[]>(() => Array(LENGTH).fill(""));
  const [formError, setFormError] = React.useState<string | null>(null);
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(CODE_TTL_SECONDS);
  const [resendIn, setResendIn] = React.useState(RESEND_COOLDOWN_SECONDS);
  const [lockoutIn, setLockoutIn] = React.useState(0);
  /** "Remember me": 30 days when ticked (the default), 12 hours when not. */
  const [remember, setRemember] = React.useState(true);

  const boxRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const joined = otp.join("");
  const complete = joined.length === LENGTH;
  const busy = login.isPending || verify.isPending;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const focusBox = React.useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(LENGTH - 1, index));
    boxRefs.current[clamped]?.focus();
  }, []);

  const writeBox = React.useCallback((index: number, value: string) => {
    setOtp((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  /** Moves into the code screen, resets every timer, and remembers the address. */
  const enterCodePhase = React.useCallback((nextEmail: string, options: { restore?: boolean } = {}) => {
    setEmail(nextEmail);
    setPhase("code");
    setOtp(Array(LENGTH).fill(""));
    setCodeError(null);
    setSecondsLeft(CODE_TTL_SECONDS);
    setResendIn(RESEND_COOLDOWN_SECONDS);
    setLockoutIn(0);

    if (!options.restore) {
      try {
        localStorage.setItem(PENDING_EMAIL_KEY, nextEmail);
      } catch {
        /* Private mode or a full quota — a refresh simply returns to Phase A. */
      }
    }
  }, []);

  /* Restores an unfinished code screen after a refresh. A *back* navigation from
   * the dashboard must land on a clean Phase A instead, so both cases are told
   * apart before anything is restored. */
  React.useEffect(() => {
    let navType: string | undefined;
    try {
      navType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
    } catch {
      navType = undefined;
    }

    let saved: string | null = null;
    try {
      saved = localStorage.getItem(PENDING_EMAIL_KEY);
    } catch {
      saved = null;
    }

    if (navType === "back_forward") {
      try {
        localStorage.removeItem(PENDING_EMAIL_KEY);
      } catch {
        /* Nothing to clear. */
      }
      return;
    }

    if (saved) enterCodePhase(saved, { restore: true });
  }, [enterCodePhase]);

  /* One ticker drives the expiry clock, the resend cooldown and the post-429
   * lockout. Server timestamps are what actually decide; this is the countdown
   * the owner watches. */
  React.useEffect(() => {
    if (phase !== "code") return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
      setResendIn((s) => Math.max(0, s - 1));
      setLockoutIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "code") return;
    const id = window.setTimeout(() => focusBox(0), 0);
    return () => window.clearTimeout(id);
  }, [phase, focusBox]);

  const clearCode = React.useCallback(
    (options: { focus?: boolean } = {}) => {
      setOtp(Array(LENGTH).fill(""));
      setCodeError(null);
      if (options.focus !== false) focusBox(0);
    },
    [focusBox],
  );

  const backToCredentials = React.useCallback(() => {
    setPhase("credentials");
    setOtp(Array(LENGTH).fill(""));
    setCodeError(null);
    setSecondsLeft(CODE_TTL_SECONDS);
    setResendIn(RESEND_COOLDOWN_SECONDS);
    setLockoutIn(0);
    try {
      localStorage.removeItem(PENDING_EMAIL_KEY);
    } catch {
      /* Nothing to clear. */
    }
    form.setFocus("email");
  }, [form]);

  const submitCode = React.useCallback(
    async (code: string) => {
      if (verify.isPending || lockoutIn > 0) return;

      setCodeError(null);

      try {
        await verify.mutateAsync({ email, code, remember });
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 0;

        if (status === 410) {
          /* Expired: inline, no redirect. Clear the boxes, stop the clock, drop
           * the resend cooldown so a fresh code can be requested immediately. */
          clearCode();
          setSecondsLeft(0);
          setResendIn(0);
          setCodeError(
            error instanceof ApiError ? error.message : "This code has expired. Request a new one below.",
          );
          return;
        }

        if (status === 401) {
          /* Clear first, then state the reason: clearing also resets the error,
           * so the order of these two calls is what makes the message visible. */
          clearCode();
          setCodeError(error instanceof ApiError ? error.message : "Invalid or expired code.");
          return;
        }

        if (status === 429) {
          const wait =
            error instanceof ApiError && error.retryAfterSeconds ? error.retryAfterSeconds : 60;
          clearCode({ focus: false });
          setLockoutIn(wait);
          setCodeError(error instanceof ApiError ? error.message : "Too many attempts.");
          return;
        }

        setCodeError(error instanceof ApiError ? error.message : "Could not verify that code.");
        return;
      }

      /* Signed in: drop the pending address so a later back-navigation cannot
       * reopen the code screen. */
      try {
        localStorage.removeItem(PENDING_EMAIL_KEY);
      } catch {
        /* Nothing to clear. */
      }
      router.push("/dashboard");
      router.refresh();
    },
    [clearCode, email, lockoutIn, remember, router, verify],
  );

  /* Auto-submit the moment all six are in. The 200ms debounce keeps a paste —
   * which fills every box in one commit — from racing a second submission. */
  React.useEffect(() => {
    if (phase !== "code" || !complete || lockoutIn > 0) return;
    const id = window.setTimeout(() => void submitCode(joined), 200);
    return () => window.clearTimeout(id);
  }, [phase, complete, joined, lockoutIn, submitCode]);

  const onSubmit = (values: Values) => {
    setFormError(null);
    const normalised = values.email.trim().toLowerCase();

    login.mutate(
      { email: normalised, password: values.password },
      {
        onSuccess: (result) => {
          if (result.nextStep === "email-otp") {
            form.reset({ email: normalised, password: "" });
            enterCodePhase(result.email);
            return;
          }
          setFormError("Unexpected response from the server. Try again.");
        },
        onError: (error) => {
          const status = error instanceof ApiError ? error.status : 0;
          const message =
            error instanceof ApiError
              ? error.message
              : "Could not sign in. Try again.";

          if (status === 401) {
            setFormError("Invalid email or password");
          } else if (status === 429) {
            /* The server puts the wait in the body and in Retry-After; the body
             * is already phrased for a person, so show it as-is. */
            setFormError(message);
          } else if (status === 500) {
            setFormError("Could not send code. Try again.");
          } else {
            setFormError(message);
          }
        },
      },
    );
  };

  /* Once the code itself has expired there is no cooldown left to serve: the
   * resend button opens up at once instead of making the user wait out a
   * 60-second clock that started when the code was created. */
  const resendGated = resendIn > 0 && secondsLeft > 0;

  const onResend = async () => {
    if (resendGated || resend.isPending) return;

    try {
      await resend.mutateAsync(email);
      toast.success("New code sent");
      /* The old code is dead the moment a new one is mailed, so the boxes go
       * back to empty rather than auto-submitting a code that no longer works. */
      setSecondsLeft(CODE_TTL_SECONDS);
      clearCode();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not resend the code.");
    } finally {
      setResendIn(RESEND_COOLDOWN_SECONDS);
    }
  };

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");

    /* Letters and symbols are ignored outright — the box keeps what it had. */
    if (raw !== "" && digits === "") return;

    if (digits === "") {
      writeBox(index, "");
      return;
    }

    /* Take the digit that was typed: with the box selected on focus, a keypress
     * over an existing digit arrives as a single replacement. */
    writeBox(index, digits.slice(-1));
    if (index < LENGTH - 1) focusBox(index + 1);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && otp[index] === "") {
      event.preventDefault();
      if (index > 0) {
        writeBox(index - 1, "");
        focusBox(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < LENGTH - 1) {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\s+/g, "").replace(/\D/g, "");
    if (!digits) return;

    setOtp((prev) => {
      const next = [...prev];
      const chunk = digits.slice(0, LENGTH - index);
      for (let i = 0; i < chunk.length; i += 1) next[index + i] = chunk[i];
      return next;
    });

    focusBox(Math.min(index + digits.length, LENGTH - 1));
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (phase === "code") {
    return (
      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Check your email
          </h1>
          <p className="text-sm text-ink-2">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-ink">{email}</span>
          </p>
        </header>

        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-base">Enter your code</CardTitle>
            <CardDescription>
              {secondsLeft > 0 ? (
                <>
                  It expires in{" "}
                  <span className="font-mono font-medium text-ink">
                    {mm}:{ss}
                  </span>
                  .
                </>
              ) : (
                <>This code has expired. Request a new one below.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (complete && !busy) void submitCode(joined);
              }}
              className="space-y-4"
            >
              <fieldset className="space-y-3" disabled={lockoutIn > 0}>
                <legend className="sr-only">Six-digit sign-in code</legend>
                <div className="flex justify-between gap-2" role="group">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        boxRefs.current[index] = el;
                      }}
                      name={`otp-${index}`}
                      value={digit}
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Digit ${index + 1} of ${LENGTH}`}
                      aria-invalid={Boolean(codeError)}
                      maxLength={1}
                      autoFocus={index === 0}
                      onChange={(event) => handleChange(index, event.target.value)}
                      onKeyDown={(event) => handleKeyDown(index, event)}
                      onPaste={(event) => handlePaste(index, event)}
                      onFocus={(event) => event.target.select()}
                      className={cn(
                        "h-12 w-full min-w-0 rounded-lg border bg-card text-center font-mono text-lg font-medium text-ink transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
                        codeError ? "border-red" : "border-input",
                      )}
                    />
                  ))}
                </div>
              </fieldset>

              {codeError ? (
                <p role="alert" className="text-xs text-red">
                  {codeError}
                </p>
              ) : null}

              <Button
                type="submit"
                className="w-full gap-1.5"
                disabled={!complete || busy || lockoutIn > 0}
              >
                {busy ? "Verifying…" : lockoutIn > 0 ? `Try again in ${lockoutIn}s` : "Verify code"}
                <ArrowRightIcon className="size-4" />
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs">
              {secondsLeft === 0 ? (
                /* Expired: one obvious way out, with no cooldown in front of it. */
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onResend()}
                  disabled={resend.isPending}
                  className="gap-1.5"
                >
                  <MailIcon className="size-3.5" />
                  {resend.isPending ? "Sending…" : "Send a new code"}
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onResend()}
                  disabled={resendGated || resend.isPending}
                  className={cn(
                    "font-medium text-orange-d underline underline-offset-2",
                    (resendGated || resend.isPending) &&
                      "cursor-not-allowed text-ink-3 no-underline",
                  )}
                >
                  {resendGated
                    ? `Didn't get it? Resend in ${resendIn}s`
                    : "Didn't get the code? Resend"}
                </button>
              )}
              <button
                type="button"
                onClick={backToCredentials}
                className="font-medium text-ink-2 underline underline-offset-2 hover:text-ink"
              >
                Use a different email
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <MailIcon className="size-3" />
            Codes expire after 10 minutes
          </span>
          {" · "}
          <Link href="/verify" className="font-medium text-orange-d underline underline-offset-2">
            Public verification
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Sign in
        </h1>
        <p className="text-sm text-ink-2">
          Staff access for owners and administrators.
        </p>
      </header>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Academy account</CardTitle>
          <CardDescription>
            Sign in with your email and password — we&rsquo;ll email you a
            6-digit code to finish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        autoFocus
                        placeholder="Email address"
                        aria-invalid={Boolean(form.formState.errors.email)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.email?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••••"
                        aria-invalid={Boolean(form.formState.errors.password)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.password?.message}</FormMessage>
                  </FormItem>
                )}
              />

              {formError ? (
                <p role="alert" className="text-xs text-red">
                  {formError}
                </p>
              ) : null}

              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(value) => setRemember(value === true)}
                />
                <label
                  htmlFor="remember"
                  className="cursor-pointer text-sm select-none text-ink-2"
                >
                  Remember me for 30 days
                </label>
              </div>
              <p className="-mt-1 text-xs text-ink-3">You can sign in from any device.</p>

              <Button
                type="submit"
                className="w-full gap-1.5"
                disabled={busy || form.formState.isSubmitting}
              >
                {login.isPending ? "Signing in…" : "Sign in"}
                <ArrowRightIcon className="size-4" />
              </Button>
            </form>
          </Form>

          <div className="mt-5">
            <AccessEntry />
          </div>

          <p className="mt-5 text-center text-[10px] text-ink-3">
            Built by Gahire Abdilillah
          </p>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <MailIcon className="size-3" />
          Codes are emailed and expire in 10 minutes
        </span>
        {" · "}
        <Link href="/verify" className="font-medium text-orange-d underline underline-offset-2">
          Public verification
        </Link>
      </p>
    </div>
  );
}
