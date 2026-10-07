import type { MetadataRoute } from "next";

import { siteBaseUrl } from "@/lib/site";

/**
 * robots.txt. The whole app is an authenticated console, so by default
 * everything is disallowed; the public pages are allowed explicitly. A sitemap
 * link is emitted only when a real public origin exists — never localhost.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/verify", "/privacy", "/terms", "/cookies", "/refund-policy"],
        disallow: "/",
      },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}