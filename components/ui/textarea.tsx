import * as React from "react";

import { cn } from "@/lib/utils/cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-ink transition-colors duration-150",
        "placeholder:text-ink-2/70 field-sizing-content",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-red aria-invalid:focus-visible:ring-red",
        "focus-visible:border-orange focus-visible:ring-2 focus-visible:ring-orange/30 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
