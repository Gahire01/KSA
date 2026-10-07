/**
 * Single source of truth for the academy's public contact details.
 *
 * Every value marked TO BE FILLED BY OWNER is deliberately unfilled: the real
 * address, phone number, email address, website and registration number are
 * not known from the codebase, so they are shown as an explicit marker rather
 * than invented. Pages that display contact details read from here, so the
 * owner fills one file and every surface updates.
 *
 * Nothing in this file may be replaced with a plausible-looking fake value.
 */

export const OWNER_TODO = "TO BE FILLED BY OWNER";

export const ACADEMY = {
  /** Legal / trading name — printed on certificates and every email. */
  name: "Kigali Safety Academy",
  /** Short name used in headings where the full name is too long. */
  shortName: "KSA",
  /** One line describing the academy, used in meta descriptions. */
  tagline: "Training, examination and certification for safer sites",
  city: "Kigali",
  country: "Rwanda",
  address: OWNER_TODO,
  phone: OWNER_TODO,
  email: OWNER_TODO,
  website: OWNER_TODO,
  /** Business registration / accreditation number shown on legal footers. */
  registrationNumber: OWNER_TODO,
} as const;

/** True while the owner has not replaced a placeholder yet. */
export function isPlaceholder(value: string): boolean {
  return value === OWNER_TODO;
}

/**
 * "Kigali Safety Academy · KN 07/…" style footer line, with the registration
 * number dropped entirely while it is still a placeholder — a made-up number
 * must never reach a public page.
 */
export function academyFooterLine(): string {
  return isPlaceholder(ACADEMY.registrationNumber)
    ? ACADEMY.name
    : `${ACADEMY.name} · ${ACADEMY.registrationNumber}`;
}

/**
 * One-line address for receipts and letterheads. While the street address is
 * unfilled only the city is shown; a phone number is appended only when real.
 */
export function academyContactLine(): string {
  const head = isPlaceholder(ACADEMY.address)
    ? ACADEMY.city
    : `${ACADEMY.address}, ${ACADEMY.city}`;
  return isPlaceholder(ACADEMY.phone) ? head : `${head} · ${ACADEMY.phone}`;
}
