import type { MetadataRoute } from "next";

import { siteBaseUrl } from "@/lib/site";

/** Every URL a search engine may index. Everything else is behind sign-in. */
const PUBLIC_PATHS = [
  { path: "/verify", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/cookies", changeFrequency: "yearly" as const, priority: 0.2 },
  { path: "/refund-policy", changeFrequency: "yearly" as const, priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteBaseUrl();
  /* Until the owner publishes a real domain, there is no absolute URL to list.
   * Emitting localhost into a sitemap would be worse than none. */
  if (!base) return [];

  return PUBLIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}