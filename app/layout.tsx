import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Suspense } from "react";

import { Providers } from "@/components/providers";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { Toaster } from "@/components/ui/sonner";
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

export const metadata: Metadata = {
  title: {
    default: "Kigali Safety Academy",
    template: "%s · Kigali Safety Academy",
  },
  description:
    "Training and certification management for Kigali Safety Academy — trainees, courses, exams, certificates, payments and reporting.",
  applicationName: "Kigali Safety Academy",
  authors: [{ name: "Kigali Safety Academy" }],
  robots: { index: false, follow: false },
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
    { media: "(prefers-color-scheme: light)", color: "#F4F2EC" },
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
        <Suspense fallback={null}>
          <Providers>{children}</Providers>
        </Suspense>
        <Toaster />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
