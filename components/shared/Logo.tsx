import * as React from "react";

import { cn } from "@/lib/utils/cn";

export function Logo({
  className,
  showWordmark = true,
  size = 36,
  wordmarkClassName,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-[10px]"
        aria-hidden
      />
      {showWordmark ? (
        <span
          className={cn(
            "font-display text-[13px] leading-tight font-semibold tracking-tight",
            wordmarkClassName,
          )}
        >
          Kigali Safety
          <br />
          Academy
        </span>
      ) : null}
    </span>
  );
}
