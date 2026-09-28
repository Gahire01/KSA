import * as React from "react";

import { cn } from "@/lib/utils/cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-sm text-ink transition-colors duration-150",
        "placeholder:text-ink-2/70",
        "file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-red aria-invalid:focus-visible:ring-red",
        "focus-visible:border-orange focus-visible:ring-2 focus-visible:ring-orange/30 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
