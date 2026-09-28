import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

/** Deadline countdown chip. Tones: >14d green, 7–14d amber, <7d or overdue red. */
export function DeadlineBadge({
  days,
  className,
  dateLabel,
}: {
  days: number;
  className?: string;
  dateLabel?: string;
}) {
  const tone =
    days < 0
      ? "bg-red-bg text-red border-red/30"
      : days === 0
        ? "bg-red-bg text-red border-red/30"
        : days <= 7
          ? "bg-red-bg text-red border-red/30"
          : days <= 14
            ? "bg-amber-bg text-amber border-amber/30"
            : "bg-green-bg text-green border-green/30";

  const label =
    days < 0
      ? `${Math.abs(days)}d overdue`
      : days === 0
        ? "Due today"
        : days === 1
          ? "1 day left"
          : `${days} days left`;

  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 font-medium tabular", tone, className)}
      title={dateLabel}
    >
      {label}
    </Badge>
  );
}
