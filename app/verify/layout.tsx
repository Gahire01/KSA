import type { Metadata } from "next";

/**
 * Metadata for the public verification area. Deliberately on the layout, not the
 * page: /verify itself is a "use client" page and cannot export metadata. The
 * token page (/verify/[token]) sets its own `robots: noindex` in its page
 * metadata, which wins over this layout's index-by-default, so one-off
 * certificate links never leak into search engines.
 */
export const metadata: Metadata = {
  title: "Certificate verification",
  description:
    "Confirm that a Kigali Safety Academy certificate is authentic and still valid by pasting its verification link or token.",
  robots: { index: true, follow: false },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}