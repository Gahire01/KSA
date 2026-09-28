"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils/cn";

/** Copy-to-clipboard with an inline check confirmation. */
export function CopyButton({
  value,
  label,
  className,
  size = 14,
  variant = "ghost",
  toastMessage,
}: {
  value: string;
  label?: string;
  className?: string;
  size?: number;
  variant?: "ghost" | "inline" | "button";
  toastMessage?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast(toastMessage ?? (label ? `${label} copied` : "Copied to clipboard"), {
      duration: 1800,
    });
    setTimeout(() => setCopied(false), 1600);
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label={label ? `Copy ${label}` : "Copy to clipboard"}
        className={cn(
          "rounded p-0.5 text-ink-2 transition-colors hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
          className,
        )}
      >
        {copied ? (
          <CheckIcon style={{ width: size, height: size }} className="text-green" />
        ) : (
          <CopyIcon style={{ width: size, height: size }} />
        )}
      </button>
    );
  }

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label={label ? `Copy ${label}` : "Copy to clipboard"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
          className,
        )}
      >
        {copied ? (
          <CheckIcon style={{ width: size, height: size }} className="text-green" />
        ) : (
          <CopyIcon style={{ width: size, height: size }} />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ? `Copy ${label}` : "Copy to clipboard"}
      className={cn(
        "rounded-md p-1.5 text-ink-2 transition-colors hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
        className,
      )}
    >
      {copied ? (
        <CheckIcon style={{ width: size, height: size }} className="text-green" />
      ) : (
        <CopyIcon style={{ width: size, height: size }} />
      )}
    </button>
  );
}
