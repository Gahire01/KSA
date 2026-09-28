"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils/cn";
import { buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "flex flex-col gap-4 sm:flex-row",
        month: "flex w-full flex-col gap-4",
        caption_label: "text-sm font-semibold text-ink",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "static",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "static",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-[11px] font-semibold text-ink-2 uppercase",
        week: "mt-1 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          "size-9 rounded-lg font-normal transition-colors duration-150 hover:bg-muted aria-selected:opacity-100",
        ),
        range_start: "rounded-l-lg bg-muted",
        range_end: "rounded-r-lg bg-muted",
        range_middle: "bg-muted",
        selected: "rounded-lg",
        today: "rounded-lg bg-accent text-orange-d",
        outside: "text-ink-2/50",
        disabled: "text-ink-2/40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClass, orientation }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", chevronClass)} />;
          }
          return <ChevronRightIcon className={cn("size-4", chevronClass)} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
