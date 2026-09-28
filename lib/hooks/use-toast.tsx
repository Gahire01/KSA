"use client";

import * as React from "react";
import { toast as sonnerToast } from "sonner";

type ToastTone = "default" | "success" | "error" | "warning" | "info";

export interface ToastOptions {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

function toneIcon(tone: ToastTone): React.ReactNode {
  const map: Record<ToastTone, React.ReactNode> = {
    default: undefined,
    success: (
      <svg viewBox="0 0 20 20" className="size-4 text-green" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
    ),
    error: (
      <svg viewBox="0 0 20 20" className="size-4 text-red" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm2.53-9.53a.75.75 0 0 0-1.06 0L10 9.94 8.53 8.47a.75.75 0 0 0-1.06 1.06L8.94 10l-1.47 1.47a.75.75 0 1 0 1.06 1.06L10 11.06l1.47 1.47a.75.75 0 0 0 1.06-1.06L11.06 10l1.47-1.47a.75.75 0 0 0 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 20 20" className="size-4 text-amber" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
    ),
    info: (
      <svg viewBox="0 0 20 20" className="size-4 text-navy-2" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8 5a.75.75 0 0 1-.75-.75v-3.5a.75.75 0 0 1 1.5 0v3.5A.75.75 0 0 1 10 15Zm0-10a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  };
  return map[tone];
}

export function useToast() {
  const show = React.useCallback((message: string, options: ToastOptions & { tone?: ToastTone } = {}) => {
    const { tone = "default", ...rest } = options;
    return sonnerToast(message, {
      icon: toneIcon(tone),
      ...rest,
    });
  }, []);

  return React.useMemo(
    () => ({
      toast: show,
      success: (m: string, o?: ToastOptions) => show(m, { ...o, tone: "success" }),
      error: (m: string, o?: ToastOptions) => show(m, { ...o, tone: "error", duration: 6000 }),
      warning: (m: string, o?: ToastOptions) => show(m, { ...o, tone: "warning" }),
      info: (m: string, o?: ToastOptions) => show(m, { ...o, tone: "info" }),
      promise: sonnerToast.promise,
      dismiss: sonnerToast.dismiss,
    }),
    [show],
  );
}
