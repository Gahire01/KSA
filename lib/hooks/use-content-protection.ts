"use client";

import * as React from "react";
import { toast } from "sonner";

import { api } from "@/lib/api/client";

/**
 * Content protection for the exam page. Only mounted by the exam runner.
 *
 * What it does, honestly: it BLOCKS copy, cut, paste, right-click and the
 * save / print / view-source / devtools shortcuts; it DETERS screenshots (the
 * PrintScreen key blurs the paper for a second, and ExamWatermark tiles the trainee's
 * name and number over it) and tab switching (every departure is logged); and it
 * makes a second tab in the same browser block itself (see use-single-tab.ts).
 * What it CANNOT do: stop a phone camera, an OS screenshot tool or hardware
 * capture. This is deterrence and evidence, not a sandbox, and nothing here claims
 * otherwise. The SERVER decides consequences (the tab-leave rule lives in the
 * integrity-flag route, not here).
 *
 * Blocked, each with a short toast and a recorded flag: right-click, F12,
 * Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+U/S/P/A, copy, cut and paste. Leaving the exam
 * window (tab hidden or window blur) is counted once per departure: the first is
 * a warning shown on return, the second fails the sitting (the server decides).
 * PrintScreen blurs
 * the paper for a second. Developer tools are guessed from window geometry and
 * only ever flagged: never an automatic failure, since a docked side panel or a
 * zoomed window triggers the same signal.
 */

export type FlagType =
  | "tab_leave"
  | "copy_attempt"
  | "cut_attempt"
  | "paste_attempt"
  | "contextmenu"
  | "shortcut"
  | "print_attempt"
  | "devtools_suspected";

export interface LockdownResult {
  /** Focus losses, as last confirmed by the server. */
  blurCount: number;
  /** True while the page is fullscreen. */
  fullscreen: boolean;
  /** True for a second after PrintScreen: blur the paper. */
  screenHidden: boolean;
  /** True from the moment the trainee returns from their first leave until they dismiss it. */
  leaveWarning: boolean;
  dismissLeaveWarning: () => void;
  requestFullscreen: () => void;
}

const DEVTOOLS_GAP_PX = 160;
const TOAST_DEDUPE_MS = 1500;
const BLUR_DEDUPE_MS = 600;

const BLOCKED_MESSAGES: Record<string, string> = {
  contextmenu: "Right-click is disabled during the exam.",
  copy_attempt: "Copying is disabled during the exam.",
  cut_attempt: "Cutting is disabled during the exam.",
  paste_attempt: "Pasting is disabled during the exam.",
  shortcut: "That shortcut is disabled during the exam.",
};

export function useContentProtection(options: {
  token: string;
  /** Called when the server ended the sitting (too many focus losses). */
  onAutoSubmitted: (result: unknown) => void;
}): LockdownResult {
  const { token, onAutoSubmitted } = options;

  const [blurCount, setBlurCount] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [screenHidden, setScreenHidden] = React.useState(false);
  const [leaveWarning, setLeaveWarning] = React.useState(false);
  const dismissLeaveWarning = React.useCallback(() => setLeaveWarning(false), []);

  const onAutoSubmittedRef = React.useRef(onAutoSubmitted);
  React.useEffect(() => {
    onAutoSubmittedRef.current = onAutoSubmitted;
  }, [onAutoSubmitted]);

  React.useEffect(() => {
    let lastToast = 0;
    let lastBlur = 0;
    let away = false;
    let devtoolsFlagged = false;
    let ended = false;

    const report = (type: FlagType) => {
      if (ended) return;
      api
        .post<{ blurCount?: number; autoSubmitted?: boolean; result?: unknown }>(
          `/exams/attempts/${encodeURIComponent(token)}/integrity-flag`,
          { type },
        )
        .then((data) => {
          if (typeof data.blurCount === "number") setBlurCount(data.blurCount);
          if (data.autoSubmitted) {
            ended = true;
            setLeaveWarning(false);
            toast.error("You left the exam window a second time. Your exam was submitted and marked as failed.");
            onAutoSubmittedRef.current(data.result);
          }
        })
        .catch(() => {
          /* Best effort: never let a failed report interrupt the paper. */
        });
    };

    const block = (type: FlagType) => {
      const now = Date.now();
      if (now - lastToast > TOAST_DEDUPE_MS) {
        lastToast = now;
        toast.warning(BLOCKED_MESSAGES[type] ?? "That is disabled during the exam.");
      }
      report(type);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      block("contextmenu");
    };

    const onClipboard = (type: FlagType) => (e: Event) => {
      e.preventDefault();
      block(type);
    };
    const onCopy = onClipboard("copy_attempt");
    const onCut = onClipboard("cut_attempt");
    const onPaste = onClipboard("paste_attempt");

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === "PrintScreen") {
        setScreenHidden(true);
        window.setTimeout(() => setScreenHidden(false), 1000);
        report("print_attempt");
        return;
      }

      const blocked =
        e.key === "F12" ||
        (mod && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
        (mod && !e.shiftKey && ["a", "c", "p", "s", "u", "v", "x"].includes(key));

      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        block("shortcut");
      }
    };

    /* Some platforms only deliver PrintScreen on keyup. */
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        setScreenHidden(true);
        window.setTimeout(() => setScreenHidden(false), 1000);
      }
    };

    /* One departure = one count, even though a tab switch fires both
     * visibilitychange and window blur. */
    const departed = () => {
      const now = Date.now();
      if (away || now - lastBlur < BLUR_DEDUPE_MS) return;
      away = true;
      lastBlur = now;
      setBlurCount((n) => n + 1);
      report("tab_leave");
    };
    const returned = () => {
      /* Only a real departure that has been reported earns the warning; a focus event
       * with no preceding leave (page load, fullscreen toggle) must not. */
      if (away) setLeaveWarning(true);
      away = false;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") departed();
      else returned();
    };

    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));

    /* A guess, nothing more: a docked inspector widens the gap between outer and
     * inner window size. Flagged once, never acted on automatically. */
    const devtoolsTimer = window.setInterval(() => {
      if (devtoolsFlagged) return;
      const gap =
        window.outerWidth - window.innerWidth > DEVTOOLS_GAP_PX ||
        window.outerHeight - window.innerHeight > DEVTOOLS_GAP_PX;
      if (gap) {
        devtoolsFlagged = true;
        report("devtools_suspected");
      }
    }, 1500);

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", departed);
    window.addEventListener("focus", returned);
    document.addEventListener("fullscreenchange", onFullscreen);
    onFullscreen();

    return () => {
      window.clearInterval(devtoolsTimer);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", departed);
      window.removeEventListener("focus", returned);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [token]);

  const requestFullscreen = React.useCallback(() => {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  return { blurCount, fullscreen, screenHidden, leaveWarning, dismissLeaveWarning, requestFullscreen };
}
