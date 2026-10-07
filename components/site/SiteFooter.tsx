import Link from "next/link";

import {
  ACADEMY,
  academyFooterLine,
  isPlaceholder,
} from "@/lib/academy/constants";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/refund-policy", label: "Refund policy" },
] as const;

/**
 * Shared public site footer: brand + registration line, real contact line
 * (city only while the street address is unfilled; phone/email become tel: and
 * mailto: links once the owner fills them), copyright year and the legal pages.
 * Used on every unauthenticated surface so the legal links and contact details
 * never drift.
 */
export function SiteFooter({
  compact = false,
  note,
}: {
  compact?: boolean;
  note?: string;
}) {
  const address = isPlaceholder(ACADEMY.address)
    ? ACADEMY.city
    : `${ACADEMY.address}, ${ACADEMY.city}`;

  return (
    <footer className="border-t border-line py-6 text-center text-xs text-ink-3">
      <p>{academyFooterLine()}</p>
      {note ? <p className="mt-0.5">{note}</p> : null}
      {!compact ? (
        <p className="mt-0.5">
          {address}
          {!isPlaceholder(ACADEMY.phone) ? (
            <>
              {" · "}
              <a
                href={`tel:${ACADEMY.phone}`}
                className="underline-offset-2 hover:text-ink-2 hover:underline"
              >
                {ACADEMY.phone}
              </a>
            </>
          ) : null}
          {!isPlaceholder(ACADEMY.email) ? (
            <>
              {" · "}
              <a
                href={`mailto:${ACADEMY.email}`}
                className="underline-offset-2 hover:text-ink-2 hover:underline"
              >
                {ACADEMY.email}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <p className="mt-1">
        © {new Date().getFullYear()} {ACADEMY.shortName}. All rights reserved.
      </p>
      <nav aria-label="Legal" className="mt-2 flex items-center justify-center gap-3">
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-ink-3 underline-offset-2 transition-colors hover:text-ink-2 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}