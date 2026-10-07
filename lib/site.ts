import { ACADEMY, isPlaceholder } from "@/lib/academy/constants";

/**
 * The single public origin for absolute URLs (sitemap, OG images, JSON-LD).
 *
 * Never emits localhost into a production artifact: metadata that would need a
 * real absolute base (sitemap, og:image) is simply withheld until the owner
 * fills ACADEMY.website or deploys behind an APP_URL. Returning null means
 * "no absolute links yet" rather than inventing a domain.
 */
export function siteBaseUrl(): string | null {
  const fromEnv = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) {
    try {
      const url = new URL(fromEnv);
      const localhostOk = process.env.NODE_ENV !== "production";
      if (url.protocol === "https:" || (localhostOk && url.hostname === "localhost")) {
        return url.origin;
      }
    } catch {
      /* A malformed env value must not invent a base. */
    }
  }

  if (!isPlaceholder(ACADEMY.website)) {
    try {
      const url = new URL(ACADEMY.website);
      if (url.protocol === "https:") return url.origin;
    } catch {
      /* A typo'd website must not surface in absolute SEO links. */
    }
  }

  return null;
}