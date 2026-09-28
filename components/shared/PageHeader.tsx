import * as React from "react";

import { cn } from "@/lib/utils/cn";
import { formatDateLong } from "@/lib/utils/format";

export function PageHeader({
  title,
  subtitle,
  description,
  actions,
  breadcrumbSlot,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbSlot?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {breadcrumbSlot}
        <h1 className="font-display text-2xl leading-tight font-semibold text-ink sm:text-[28px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-ink-2">{subtitle}</p>
        ) : null}
        {description ? (
          <p className="max-w-2xl text-sm text-ink-2">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function TodaySubtitle({ prefix = "" }: { prefix?: string }) {
  return (
    <span title={new Date().toISOString()}>
      {prefix}
      {formatDateLong(new Date())}
    </span>
  );
}
