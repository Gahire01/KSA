import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
  isValid,
  parseISO,
} from "date-fns";

/* ── Currency ─────────────────────────────────────────────────────
   All money is shown as "45,000 RWF" — thin-space thousands, no
   decimals. Amounts in words are used on receipts.
   ──────────────────────────────────────────────────────────────── */

export function formatRwf(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(amount),
  )} RWF`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

const ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

function chunkToWords(chunk: number): string {
  const words: string[] = [];
  if (chunk >= 100) {
    words.push(ONES[Math.floor(chunk / 100)], "Hundred");
    chunk %= 100;
  }
  if (chunk >= 20) {
    words.push(TENS[Math.floor(chunk / 10)]);
    chunk %= 10;
    if (chunk > 0) words.push(ONES[chunk]);
  } else if (chunk > 0) {
    words.push(ONES[chunk]);
  }
  return words.join(" ");
}

export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "Zero Rwandan Francs";
  let n = Math.round(amount);
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i];
    if (g === 0) continue;
    parts.push(`${chunkToWords(g)}${SCALES[i] ? ` ${SCALES[i]}` : ""}`);
  }
  const words = parts.join(" ").trim();
  return `${words} Rwandan Francs`;
}

/* ── Dates ────────────────────────────────────────────────────────
   Display: "25 Sep 2026" · Tooltip: ISO 8601
   ──────────────────────────────────────────────────────────────── */

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value);
}

export function formatDate(
  value: string | Date | null | undefined,
  pattern = "d MMM yyyy",
): string {
  if (!value) return "—";
  const d = toDate(value);
  if (!isValid(d)) return "—";
  return format(d, pattern);
}

export function formatDateLong(value: string | Date | null | undefined): string {
  return formatDate(value, "d MMMM yyyy");
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, "d MMM yyyy, HH:mm");
}

export function formatTime(value: string | Date | null | undefined): string {
  return formatDate(value, "HH:mm");
}

export function toIso(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = toDate(value);
  return isValid(d) ? d.toISOString() : "—";
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = toDate(value);
  if (!isValid(d)) return "—";
  if (isToday(d)) return formatDistanceToNowStrict(d, { addSuffix: true });
  if (isYesterday(d)) return "yesterday";
  const days = differenceInCalendarDays(new Date(), d);
  if (days > 0 && days < 7) return `${days} days ago`;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function daysBetween(from: string | Date, to: string | Date): number {
  return differenceInCalendarDays(toDate(to), toDate(from));
}

export function daysLeft(value: string | Date): number {
  return differenceInCalendarDays(toDate(value), new Date());
}

export function deadlineTone(days: number): "green" | "amber" | "red" {
  if (days > 14) return "green";
  if (days >= 7) return "amber";
  return "red";
}

/* ── Misc ──────────────────────────────────────────────────────── */

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function formatDurationLabel(
  value: number,
  unit: "day" | "week" | "month",
): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function truncateHash(hash: string, head = 10, tail = 8): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : (plural ?? `${singular}s`);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function sentenceCase(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1).replaceAll("_", " ");
}

/** Human labels for the six trainee categories. */
export const CATEGORY_LABEL: Record<string, string> = {
  Firefighters: "Firefighters",
  Maintenance: "Maintenance",
  "First aid": "First aid",
  "Site security": "Site security",
  "Electrical safety": "Electrical safety",
  "Working at height": "Working at height",
};

export function categoryLabel(value: string): string {
  return CATEGORY_LABEL[value] ?? titleCase(value);
}

export const CERTIFICATE_STATUS_LABEL: Record<string, string> = {
  VALID: "Valid",
  REVOKED: "Revoked",
  PENDING: "Pending issue",
};
