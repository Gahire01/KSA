import * as React from "react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

export function StatCard({
  label,
  value,
  changePct,
  hint,
  icon,
  href,
  isLoading,
  invertTrend = false,
  className,
  children,
}: {
  label: string;
  value: React.ReactNode;
  changePct?: number;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  isLoading?: boolean;
  /** Set when a decrease is good news (e.g. expiring certificates). */
  invertTrend?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-2 uppercase">
          {label}
        </p>
        {icon ? (
          <span aria-hidden className="flex size-7 items-center justify-center rounded-lg bg-muted text-ink-2">
            {icon}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-1.5 font-display text-[28px] leading-none font-semibold text-ink tabular">
          {value}
        </p>
      )}

      <div className="mt-2 flex min-h-5 items-center gap-2">
        {typeof changePct === "number" && !isLoading ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular",
              changePct === 0
                ? "bg-muted text-ink-2"
                : (changePct > 0) !== invertTrend
                  ? "bg-green-bg text-green"
                  : "bg-red-bg text-red",
            )}
          >
            {changePct === 0 ? null : changePct > 0 ? (
              <TrendingUpIcon className="size-3" />
            ) : (
              <TrendingDownIcon className="size-3" />
            )}
            {changePct > 0 ? "+" : ""}
            {changePct}%
          </span>
        ) : null}
        {hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
      </div>

      {children}
    </>
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-card p-4 shadow-sm transition-shadow",
        href && "hover:shadow-md",
        className,
      )}
    >
      {href ? (
        <a href={href} className="block rounded-[inherit] focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none">
          {body}
        </a>
      ) : (
        body
      )}
    </div>
  );
}
