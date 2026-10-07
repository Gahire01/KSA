import { ACADEMY } from "@/lib/academy/constants";
import { siteBaseUrl } from "@/lib/site";

/**
 * Organization/EducationOrganization JSON-LD for the whole site.
 *
 * Only facts that are real are emitted: while the website, phone and street
 * address are TO BE FILLED BY OWNER, those fields are omitted instead of
 * carrying invented values. City + country are known, so the address object is
 * always present.
 */
export function LocalBusinessJsonLd() {
  const base = siteBaseUrl();

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ACADEMY.name,
    ...(base ? { url: base } : {}),
    ...(base ? { logo: `${base}/logo.png` } : {}),
    description: ACADEMY.tagline,
    address: {
      "@type": "PostalAddress",
      addressLocality: ACADEMY.city,
      addressCountry: ACADEMY.country,
    },
  } as const;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
    />
  );
}