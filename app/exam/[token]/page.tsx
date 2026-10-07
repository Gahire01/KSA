"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OtpInput } from "@/components/exam/OtpInput";
import {
  ExamRunner,
  ExamSubmitted,
  type RunnerPaper,
  type RunnerResult,
} from "@/components/exam/ExamRunner";
import { api, ApiError } from "@/lib/api/client";
import { useSingleTab } from "@/lib/hooks/use-single-tab";
import { LINK_EXPIRED_MESSAGE, LINK_USED_MESSAGE, OTP_EXPIRED_MESSAGE } from "@/lib/exams/link";
import { toast } from "sonner";

/**
 * Two phases, and the boundary between them is the OTP.
 *
 * Phase A asks for the six-digit code. Phase B is the approved exam runner,
 * unchanged in design, now fed by the real API.
 *
 * Crucially, Phase A looks identical whether the token is real or not. The page
 * never learns why a code failed — verify-otp returns one generic 401 — so this
 * cannot be used to probe which exam links exist.
 *
 * The countdown in Phase A is advisory: the server enforces `otpExpiresAt` on
 * every attempt, so a tampered client clock buys nothing.
 */

const COUNTDOWN_SECONDS = 30 * 60;

type Phase = "checking" | "otp" | "paper" | "submitted" | "blocked" | "stalled" | "ended";

export default function ExamPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token ?? "";

  const [phase, setPhase] = React.useState<Phase>("checking");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [resendBusy, setResendBusy] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(COUNTDOWN_SECONDS);
  const [paper, setPaper] = React.useState<RunnerPaper | null>(null);
  const [result, setResult] = React.useState<RunnerResult | null>(null);
  const [blockedMessage, setBlockedMessage] = React.useState<string>(LINK_USED_MESSAGE);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [briefed, setBriefed] = React.useState(false);

  /* One tab per exam: a second tab on the same paper is blocked, not the first. */
  const tabState = useSingleTab(token, phase === "paper");

  /* Already-open exams skip Phase A: the cookie proves the OTP was entered. */
  React.useEffect(() => {
    if (!token) return;

    let cancelled = false;

    api
      .get<RunnerPaper>(`/exams/attempts/${encodeURIComponent(token)}/next`)
      .then((loaded) => {
        if (cancelled) return;
        setPaper(loaded);
        setPhase("paper");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        const timeUp = loadError instanceof ApiError && loadError.status === 410;
        /* No cookie: find out whether the link is still usable before asking for
         * a code, so a dead link says so instead of failing at the code box. */
        api
          .get<{ state: "open" | "resume" | "expired" | "used" }>(
            `/exams/attempts/${encodeURIComponent(token)}/status`,
          )
          .then(({ state }) => {
            if (cancelled) return;
            if (state === "resume") {
              /* The cookie is valid, so this trainee already holds the exam and the
               * paper simply failed to load. Asking for a code would dead-end (the
               * server answers "already open"), so offer a retry, or if the clock
               * has run out, hand in what was saved. */
              if (timeUp) {
                api
                  .post(`/exams/attempts/${encodeURIComponent(token)}/submit`, {})
                  .then(() => {
                    if (!cancelled) setPhase("ended");
                  })
                  /* Only claim it was handed in if it was: a failed submit goes back
                   * to the retry panel, where "Try again" repeats it. */
                  .catch(() => {
                    if (!cancelled) setPhase("stalled");
                  });
              } else {
                setPhase("stalled");
              }
            } else if (state === "expired" || state === "used") {
              setBlockedMessage(state === "expired" ? LINK_EXPIRED_MESSAGE : LINK_USED_MESSAGE);
              setPhase("blocked");
            } else {
              setPhase("otp");
            }
          })
          .catch(() => {
            if (!cancelled) setPhase("otp");
          });
      });

    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  /* Advisory countdown. The server is authoritative on expiry. */
  React.useEffect(() => {
    if (phase !== "otp" || secondsLeft === null) return;

    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s === null || s <= 0 ? 0 : s - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [phase, secondsLeft]);

  const verify = React.useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);

      try {
        const verified = await api.post<{
          manifest: { questionIds: string[] };
          examDurationMin: number;
          courseName: string;
          traineeName: string;
          passMarkPct: number;
          questionCount: number;
          linkExpiresAt: string;
        }>(`/exams/attempts/${encodeURIComponent(token)}/verify-otp`, { code });

        /* The manifest alone is not enough to render — fetch the paper. */
        const loaded = await api.get<RunnerPaper>(
          `/exams/attempts/${encodeURIComponent(token)}/next`,
        );

        setPaper(loaded);
        setPhase("paper");
        toast.success("Code accepted", {
          description: `${loaded.courseName} · ${verified.questionCount} questions · ${verified.examDurationMin} minutes`,
        });
      } catch (err) {
        /* An expired CODE is an inline error, not a dead end: stay on this
         * screen, clear the boxes (OtpInput reacts to the new error), and let
         * the resend button issue a fresh code. Only a dead LINK leaves. */
        if (err instanceof ApiError && err.status === 410) {
          if (err.message === OTP_EXPIRED_MESSAGE) {
            setSecondsLeft(0);
            setError(OTP_EXPIRED_MESSAGE);
            return;
          }
          setBlockedMessage(err.message);
          setPhase("blocked");
          return;
        }
        /* Every failure gets the same message; the boxes clear themselves. */
        setError(
          err instanceof ApiError && err.status === 429
            ? err.message
            : "That code is not right. Check the email and try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  const resend = React.useCallback(async () => {
    setResendBusy(true);
    setError(null);

    try {
      await api.post(`/exams/attempts/${encodeURIComponent(token)}/resend-otp`);
      setSecondsLeft(COUNTDOWN_SECONDS);
      toast.success("We sent a new code", {
        description: "Check your inbox — it should arrive within a minute.",
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not send a new code. Try again in a minute.",
      );
    } finally {
      setResendBusy(false);
    }
  }, [token]);

  const onSubmitted = React.useCallback((submitted: RunnerResult) => {
    setResult(submitted);
    setPhase("submitted");
  }, []);

  if (phase === "checking") {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (phase === "submitted" && result && paper) {
    return (
      <>
        <ExamSubmitted
          result={result}
          courseName={paper.courseName}
          submittedAt={new Date().toISOString()}
        />
      </>
    );
  }

  if (phase === "stalled") {
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-16 text-center">
        <Logo />
        <p className="text-base text-ink">
          We could not load your exam just now. Your answers are saved. Check your connection and try again.
        </p>
        <Button
          type="button"
          onClick={() => {
            setPhase("checking");
            setReloadKey((k) => k + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-16 text-center">
        <Logo />
        <p className="text-base text-ink">
          Your exam time has ended and your saved answers were submitted. The academy will share your result.
        </p>
      </div>
    );
  }

  if (phase === "blocked") {
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-16 text-center">
        <Logo />
        <p className="text-base text-ink">{blockedMessage}</p>
      </div>
    );
  }

  if (phase === "paper" && paper) {
    if (tabState === "blocked") {
      return (
        <div className="mx-auto max-w-xl space-y-5 px-4 py-16 text-center">
          <Logo />
          <h1 className="font-display text-xl text-ink">This exam is open in another tab</h1>
          <p className="text-base text-ink-2">
            For fairness the exam can only be open in one tab at a time. Close this tab and
            return to the one that is already running your exam.
          </p>
        </div>
      );
    }
    if (tabState === "checking") {
      return (
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      );
    }
    return <ExamRunner token={token} paper={paper} onSubmitted={onSubmitted} />;
  }

  /* Briefing first. "Begin" is a click, which is what lets the browser grant
   * fullscreen, and the exam clock has not started yet (it starts when the code is
   * accepted), so reading this costs no exam time. */
  if (!briefed) {
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-16 text-center">
        <Logo />
        <h1 className="font-display text-xl text-ink">Before you begin</h1>
        <p className="text-base text-ink-2">
          This exam is monitored. Right-click, copy, and switching tabs are disabled. Focus loss is recorded.
          Click &lsquo;Begin&rsquo; to start.
        </p>
        <Button
          type="button"
          onClick={() => {
            void document.documentElement.requestFullscreen?.().catch(() => undefined);
            setBriefed(true);
          }}
        >
          Begin
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
      <Logo />

      <OtpInput
        onSubmit={(code) => void verify(code)}
        onResend={() => void resend()}
        busy={busy}
        resendBusy={resendBusy}
        error={error}
        secondsLeft={secondsLeft}
      />

      <p className="text-center text-xs text-ink-3">
        Lost the email?{" "}
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="font-medium text-orange-d underline underline-offset-2"
        >
          Ask the academy to send a new link
        </button>
      </p>
    </div>
  );
}