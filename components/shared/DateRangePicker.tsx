"use client";

import * as React from "react";
import { format, parseISO, subMonths, subDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

export interface DateRange {
  from?: string;
  to?: string;
}

type Preset = { label: string; range: () => DateRange };

const toIso = (d: Date) => format(d, "yyyy-MM-dd");

const PRESETS: Preset[] = [
  { label: "Today", range: () => ({ from: toIso(new Date()), to: toIso(new Date()) }) },
  { label: "Last 7 days", range: () => ({ from: toIso(subDays(new Date(), 6)), to: toIso(new Date()) }) },
  { label: "Last 30 days", range: () => ({ from: toIso(subDays(new Date(), 29)), to: toIso(new Date()) }) },
  {
    label: "This month",
    range: () => ({ from: toIso(startOfMonth(new Date())), to: toIso(endOfMonth(new Date())) }),
  },
  {
    label: "Last month",
    range: () => {
      const d = subMonths(new Date(), 1);
      return { from: toIso(startOfMonth(d)), to: toIso(endOfMonth(d)) };
    },
  },
  {
    label: "This quarter",
    range: () => ({ from: toIso(startOfQuarter(new Date())), to: toIso(endOfQuarter(new Date())) }),
  },
  {
    label: "This year",
    range: () => ({ from: toIso(startOfYear(new Date())), to: toIso(endOfYear(new Date())) }),
  },
];

export function DateRangePicker({
  value,
  onChange,
  className,
  align = "start",
  placeholder = "Any date",
  label = "Date range",
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  align?: "start" | "end" | "center";
  placeholder?: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<DateRange>(value);

  React.useEffect(() => {
    if (open) setPending(value);
  }, [open, value]);

  const selectedFrom = value.from ? parseISO(value.from) : undefined;
  const selectedTo = value.to ? parseISO(value.to) : undefined;

  const display =
    value.from && value.to
      ? `${formatDate(value.from)} – ${formatDate(value.to)}`
      : value.from
        ? `From ${formatDate(value.from)}`
        : value.to
          ? `Until ${formatDate(value.to)}`
          : placeholder;

  const activePreset = PRESETS.find((p) => {
    const r = p.range();
    return r.from === value.from && r.to === value.to;
  })?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-2 font-normal", className)}
          aria-label={`${label}: ${display}`}
        >
          <CalendarIcon className="size-4 opacity-70" />
          <span className="tabular">{display}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex flex-col sm:flex-row">
          <div className="w-44 shrink-0 space-y-0.5 border-b border-line p-2 sm:border-r sm:border-b-0">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const r = preset.range();
                  onChange(r);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
                  activePreset === preset.label && "bg-accent font-medium text-orange-d",
                )}
              >
                {preset.label}
              </button>
            ))}
            <Separator className="my-1.5" />
            <button
              type="button"
              onClick={() => {
                onChange({});
                setOpen(false);
              }}
              className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-ink-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
            >
              Clear
            </button>
          </div>
          <div className="p-1">
            <Calendar
              mode="range"
              numberOfMonths={1}
              defaultMonth={selectedFrom ?? new Date()}
              selected={
                selectedFrom && selectedTo
                  ? { from: selectedFrom, to: selectedTo }
                  : selectedFrom
                    ? { from: selectedFrom, to: selectedTo ?? undefined }
                    : undefined
              }
              onSelect={(range) => {
                if (range?.from) {
                  setPending({
                    from: toIso(range.from),
                    to: range.to ? toIso(range.to) : undefined,
                  });
                } else {
                  setPending({});
                }
              }}
            />
            <div className="flex items-center justify-end gap-2 border-t border-line p-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!pending.from}
                onClick={() => {
                  onChange(pending);
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
