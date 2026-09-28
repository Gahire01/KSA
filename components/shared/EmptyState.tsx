import * as React from "react";
import { InboxIcon } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-6 py-10" : "gap-3 px-6 py-16",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-line bg-muted text-ink-2",
          compact ? "size-10" : "size-14",
        )}
        aria-hidden
      >
        {icon ?? <InboxIcon className={compact ? "size-5" : "size-6"} />}
      </div>
      <div className="space-y-1">
        <p className="font-display text-sm font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-ink-2">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
