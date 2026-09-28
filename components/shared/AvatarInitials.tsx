"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";
import { hashString } from "@/lib/utils/ids";
import { initials } from "@/lib/utils/format";

/** Six navy/orange-adjacent hues, all ≥ 4.5:1 against their own tint. */
const PALETTE = [
  { bg: "#1B3A63", fg: "#FFFFFF" },
  { bg: "#0F2340", fg: "#E8EEF6" },
  { bg: "#B7430F", fg: "#FFF3EC" },
  { bg: "#1F7A4D", fg: "#E8F6EE" },
  { bg: "#5B5B55", fg: "#F2F2EF" },
  { bg: "#4A2C6B", fg: "#F1E9FA" },
];

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
  xl: "size-20 text-2xl",
} as const;

export function AvatarInitials({
  name,
  size = "md",
  className,
  title,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}) {
  const [bg, fg] = React.useMemo(() => {
    const idx = hashString(name || "?") % PALETTE.length;
    const p = PALETTE[idx] ?? PALETTE[0]!;
    return [p.bg, p.fg];
  }, [name]);

  return (
    <span
      role="img"
      aria-label={title ?? name}
      title={title ?? name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight select-none",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      {initials(name)}
    </span>
  );
}
