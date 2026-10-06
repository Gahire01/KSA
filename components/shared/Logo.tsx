import Image from "next/image";

import { cn } from "@/lib/utils/cn";

export function Logo({
  className,
  showWordmark = true,
  size = 36,
  wordmarkClassName,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt="Kigali Safety Academy"
        width={size}
        height={size}
        className="shrink-0 rounded-[10px]"
        priority={false}
      />
      {showWordmark ? (
        <span
          className={cn(
            "font-display text-[13px] leading-tight font-semibold tracking-tight",
            wordmarkClassName,
          )}
        >
          Kigali Safety
          <br />
          Academy
        </span>
      ) : null}
    </span>
  );
}
