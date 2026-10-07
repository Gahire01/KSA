import { NAV_SECTIONS, sectionItems } from "@/components/layout/Sidebar";

export interface Crumb {
  label: string;
  href: string;
}

const titleCase = (slug: string) =>
  slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const looksLikeId = (seg: string) => /^[0-9a-f-]{8,}$/i.test(seg) || /^c[a-z0-9]{20,}$/.test(seg);

/**
 * Builds the trail from the real pathname. The nav config is the source of
 * truth for labels; unknown segments are title-cased and opaque ids become "Details".
 */
export function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || pathname === "/dashboard") {
    return [
      { label: "Main", href: "/dashboard" },
      { label: "Dashboard", href: "/dashboard" },
    ];
  }

  const items = NAV_SECTIONS.flatMap(sectionItems);
  const crumbs: Crumb[] = [];
  segments.forEach((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const section =
      i === 0 ? NAV_SECTIONS.find((s) => s.title.toLowerCase() === seg.toLowerCase()) : undefined;
    const item = items.find((it) => it.href === href);
    const label = section?.title ?? item?.label ?? (looksLikeId(seg) ? "Details" : titleCase(seg));
    crumbs.push({ label, href });
  });

  // A bare section index ("/trainees") reads "Trainees / All trainees".
  if (crumbs.length === 1) {
    const item = items.find((it) => it.href === crumbs[0].href);
    if (item && item.label !== crumbs[0].label) crumbs.push({ label: item.label, href: item.href });
  }
  return crumbs;
}
