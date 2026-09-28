"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export interface Chip {
  id: string;
  label: string;
  value?: string;
  onRemove?: () => void;
}

export function FilterChips({
  chips,
  onClearAll,
  className,
  clearLabel = "Clear all",
}: {
  chips: Chip[];
  onClearAll?: () => void;
  className?: string;
  clearLabel?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {chips.map((chip) => (
        <Badge key={chip.id} variant="outline" className="gap-1 pr-1 pl-2.5">
          <span className="text-ink-2">{chip.label}:</span>
          <span className="font-medium text-ink">{chip.value ?? chip.label}</span>
          {chip.onRemove ? (
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove filter ${chip.label}${chip.value ? ` ${chip.value}` : ""}`}
              className="ml-0.5 rounded p-0.5 text-ink-2 transition-colors hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-orange"
            >
              <XIcon className="size-3" />
            </button>
          ) : null}
        </Badge>
      ))}
      {onClearAll ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onClearAll}
          className="h-6 px-1.5 text-xs"
        >
          {clearLabel}
        </Button>
      ) : null}
    </div>
  );
}
