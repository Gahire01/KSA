/** Shared public origin for email links and certificate QR codes. */
export function appUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.APP_URL?.trim()
    || "https://ksa-rw.vercel.app";
  return `${base.replace(/\/+$/, "")}${path}`;
}
