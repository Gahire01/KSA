import * as React from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Loading placeholder. The shimmer sweep (see `.ksa-shimmer` in globals.css) only
 * runs when the user has not asked for reduced motion; otherwise it is a flat block.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("ksa-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
