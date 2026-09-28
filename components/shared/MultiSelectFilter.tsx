"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Checkbox multi-select in a popover. Used for course, category, status and
 * country filters across the list pages.
 */
export function MultiSelectFilter({
  options,
  selected,
  onChange,
  label,
  placeholder = "Any",
  searchable = false,
  className,
  width = "w-64",
  align = "start",
}: {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  label: string;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  width?: string;
  align?: "start" | "end" | "center";
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-1.5 font-normal",
            selected.length > 0 && "border-orange/50 bg-orange-bg/40",
            className,
          )}
          aria-label={`${label}: ${summary}`}
        >
          <span className="text-ink-2">{label}:</span>
          <span className={cn("max-w-40 truncate", selected.length === 0 && "text-ink-2")}>
            {summary}
          </span>
          <ChevronDownIcon className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className={cn("p-0", width)}>
        {searchable ? (
          <div className="border-b border-line p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="h-8"
            />
          </div>
        ) : null}

        <div className="max-h-64 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-ink-2">No matches.</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <li key={option.value}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted",
                        checked && "bg-accent/50",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(option.value)}
                        aria-label={option.label}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">
                          {option.label}
                        </span>
                        {option.hint ? (
                          <span className="block truncate text-xs text-ink-3">
                            {option.hint}
                          </span>
                        ) : null}
                      </span>
                      {checked ? (
                        <CheckIcon className="size-3.5 shrink-0 text-orange" />
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected.length > 0 ? (
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
            <Badge variant="outline" className="tabular">
              {selected.length} selected
            </Badge>
            <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => onChange([])}>
              <XIcon className="size-3" />
              Clear
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
