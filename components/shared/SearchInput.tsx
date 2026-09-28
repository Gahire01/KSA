"use client";

import * as React from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export const SearchInput = React.forwardRef<
  HTMLInputElement,
  {
    value: string;
    onValueChange: (v: string) => void;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    label?: string;
    /** "/" focuses the field. */
    enableSlashShortcut?: boolean;
  }
>(function SearchInput(
  {
    value,
    onValueChange,
    placeholder = "Search…",
    className,
    inputClassName,
    label = "Search",
    enableSlashShortcut = true,
  },
  ref,
) {
  const localRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => localRef.current as HTMLInputElement, []);

  React.useEffect(() => {
    if (!enableSlashShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        localRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableSlashShortcut]);

  return (
    <div className={cn("relative w-full", className)}>
      <label htmlFor="ksa-search" className="sr-only">
        {label}
      </label>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2"
        aria-hidden
      />
      <Input
        id="ksa-search"
        ref={localRef}
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={cn("pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden", inputClassName)}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onValueChange("");
            localRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-ink-2 transition-colors hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-orange"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
});
