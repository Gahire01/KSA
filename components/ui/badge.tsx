import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium transition-colors [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-navy text-white",
        neutral: "border-line bg-muted text-ink-2",
        green: "border-transparent bg-green-bg text-green",
        amber: "border-transparent bg-amber-bg text-amber",
        red: "border-transparent bg-red-bg text-red",
        orange: "border-transparent bg-accent text-orange-d",
        outline: "border-line bg-transparent text-ink-2",
      },
      size: {
        default: "text-xs",
        sm: "px-1.5 py-0 text-[11px]",
      },
    },
    defaultVariants: { variant: "neutral", size: "default" },
  },
);

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
