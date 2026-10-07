import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export function Logo({
  className,
  showWordmark = true,
  size = 36,
  wordmarkClassName,
  href,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
  wordmarkClassName?: string;
  /** When set, the logo becomes a link (used on the public pages). */
  href?: string;
}) {
  const badge = (
    <Image
      src="/logo.png"
      alt="Kigali Safety Academy"
      width={size}
      height={size}
      className="shrink-0 rounded-[10px]"
      priority={false}
    />
  );
  const wordmark = showWordmark ? (
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
  ) : null;

  if (href) {
    return (
      <Link
        href={href}
        aria-label="Kigali Safety Academy — home"
        className={cn(
          "inline-flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none",
          className,
        )}
      >
        {badge}
        {wordmark}
      </Link>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {badge}
      {wordmark}
    </span>
  );
}