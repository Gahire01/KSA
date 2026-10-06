/**
 * Best-effort IP → place lookup for the sessions list.
 *
 * Rules that keep it safe and quiet:
 *
 *  - Private, loopback and link-local addresses never leave the server.
 *  - The lookup is bounded by a short timeout and one try; a slow or unreachable
 *    geo service must never delay the sessions list, so a failure answers `null`
 *    and the UI prints an em dash.
 *  - Results are memoised per process for the IP's lifetime, because the same
 *    handful of office and phone addresses recur on every page load.
 */

const CACHE = new Map<string, string | null>();
const CACHE_MAX = 500;
const TIMEOUT_MS = 1200;

function isPrivate(ip: string): boolean {
  const value = ip.trim().toLowerCase();

  if (
    value === "localhost" ||
    value === "::1" ||
    value === "127.0.0.1" ||
    value === "0.0.0.0" ||
    value.startsWith("fe80:") ||
    value.startsWith("fc") ||
    value.startsWith("fd")
  ) {
    return true;
  }

  const v4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;

  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
    return true;
  }
  if (a === 169 && b === 254) return true;

  return false;
}

export async function lookupLocation(ip: string | null | undefined): Promise<string | null> {
  const address = ip?.trim() ?? "";
  if (!address || isPrivate(address)) return null;

  if (CACHE.has(address)) return CACHE.get(address) ?? null;

  let result: string | null = null;

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(address)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });

    if (response.ok) {
      const body = (await response.json()) as {
        success?: boolean;
        city?: string;
        region?: string;
        country?: string;
      };

      if (body.success !== false) {
        const place = [body.city, body.region || body.country].filter(Boolean).join(", ");
        result = place || body.country || null;
      }
    }
  } catch {
    /* Offline, blocked, or too slow — the list still renders without a place. */
    result = null;
  }

  if (CACHE.size >= CACHE_MAX) CACHE.clear();
  CACHE.set(address, result);

  return result;
}
