import type { NextConfig } from "next";

/**
 * Next.js injects inline bootstrap scripts, so `script-src` cannot drop
 * 'unsafe-inline' outright. It stays confined to scripts, and `object-src
 * 'none'` plus `base-uri 'self'` stop the inline allowance being escalated into
 * injected markup or a rewritten base URL. 'unsafe-eval' is development-only:
 * React Refresh needs it, and it must never reach production.
 */
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  /* The TOTP enrolment QR is a data: image generated server-side. */
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  /* Keeps the app on its own origin: no third-party fetch, no framing. */
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    /* This app needs no camera, mic, geolocation or payment access. */
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* ExcelJS drags in an old rimraf that the bundler cannot resolve under pnpm's strict layout;
   * left external, Node resolves its own dependencies at runtime. */
  serverExternalPackages: ["exceljs"],
  typedRoutes: false,
  devIndicators: false,
  /* The certificate PDF reads the logo and the legacy signature straight off disk. Next's
   * file tracing only follows imports, so without this a serverless deploy would drop
   * those files and every PDF would silently print without them. */
  outputFileTracingIncludes: {
    "/api/certificates/[id]/pdf": ["./public/logo.png", "./public/certificate/signature.png"],
    "/api/reports/[type]": ["./public/logo.png"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "motion", "@tanstack/react-table"],
  },
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
