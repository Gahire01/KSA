import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Suspense } from "react";

import { Providers } from "@/components/providers";
import { CookieConsent } from "@/components/site/CookieConsent";
import { LocalBusinessJsonLd } from "@/components/site/LocalBusinessJsonLd";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { Toaster } from "@/components/ui/sonner";
import { ACADEMY } from "@/lib/academy/constants";
import { siteBaseUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const base = siteBaseUrl();

export const metadata: Metadata = {
  /* Canonical/OG fall back to the request origin when a base is not configured;
   * absolute base is set only for a real public origin, never localhost. */
  metadataBase: base ? new URL(base) : undefined,
  title: {
    default: "Kigali Safety Academy",
    template: "%s · Kigali Safety Academy",
  },
  description:
    "Training and certification management for Kigali Safety Academy — trainees, courses, exams, certificates, payments and reporting.",
  applicationName: "Kigali Safety Academy",
  authors: [{ name: "Kigali Safety Academy" }],
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "en_RW",
    siteName: "Kigali Safety Academy",
    title: "Kigali Safety Academy",
    description: ACADEMY.tagline,
    url: base ? `${base}/verify` : undefined,
    ...(base
      ? {
          images: [
            {
              url: `${base}/og-image.png`,
              width: 1200,
              height: 630,
              alt: "Kigali Safety Academy",
            },
          ],
        }
      : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: "Kigali Safety Academy",
    description: ACADEMY.tagline,
    ...(base ? { images: [`${base}/og-image.png`] } : {}),
  },
  /* PWA. The manifest carries the icon list, so metadata only points at it —
   * keeping one source for the icons rather than two lists that drift. */
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  /* iOS ignores the manifest; it wants its own meta tags, and it installs from
   * the home screen only when these are present. */
  appleWebApp: {
    capable: true,
    title: "KSA",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F2340" },
    { media: "(prefers-color-scheme: dark)", color: "#101823" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <a href="#main-content" className="skip-link no-print">
          Skip to main content
        </a>
        <LocalBusinessJsonLd />
        <Suspense fallback={null}>
          <Providers>{children}</Providers>
        </Suspense>
        <Toaster />
        <ServiceWorkerRegistration />
        <CookieConsent />
      </body>
    </html>
  );
}
