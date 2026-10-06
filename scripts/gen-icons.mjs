/**
 * Generates the PWA icon set from public/logo.png.
 *
 * Run with: node scripts/gen-icons.mjs
 *
 * The set is derived from one source rather than hand-exported from a design
 * file, so swapping the logo means re-running this instead of re-exporting
 * nine assets. Dev-only: the PNGs are committed, so a fresh checkout builds
 * without running it.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = path.join(root, "public", "icons");
const source = path.join(root, "public", "logo.png");

/**
 * A standard icon: the logo exactly as it ships, corners and all.
 */
async function standardPng(size) {
  return sharp(source)
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * A maskable icon: full-bleed square (Android masks to a circle, so a rounded
 * or transparent corner would show the backdrop) with the artwork held to ~64%
 * so it stays inside the 80% safe zone.
 */
async function maskablePng(size) {
  const inner = Math.round(size * 0.64);
  const logo = await sharp(source).resize(inner, inner, { fit: "cover" }).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: "#0F2340" },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const targets = [
  { name: "icon-192.png", size: 192, make: standardPng },
  { name: "icon-512.png", size: 512, make: standardPng },
  { name: "maskable-192.png", size: 192, make: maskablePng },
  { name: "maskable-512.png", size: 512, make: maskablePng },
  { name: "apple-touch-icon.png", size: 180, make: maskablePng },
  { name: "icon-96.png", size: 96, make: standardPng },
  { name: "favicon-48.png", size: 48, make: standardPng },
  { name: "favicon-32.png", size: 32, make: standardPng },
  { name: "favicon-16.png", size: 16, make: standardPng },
];

await mkdir(outDir, { recursive: true });

for (const target of targets) {
  const png = await target.make(target.size);
  await writeFile(path.join(outDir, target.name), png);
  console.log(`${target.name}  ${target.size}x${target.size}  ${png.length} B`);
}

/* The SVG favicon carries the artwork inline so it stays sharp at any zoom and
 * the manifest's `"sizes": "any"` entry keeps working with the new logo. */
const embed = await sharp(source)
  .resize(256, 256, { fit: "cover" })
  .png({ compressionLevel: 9 })
  .toBuffer();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="Kigali Safety Academy"><image width="256" height="256" href="data:image/png;base64,${embed.toString("base64")}"/></svg>`;
await writeFile(path.join(outDir, "icon.svg"), svg);
console.log(`icon.svg  ${svg.length} B`);

console.log(`\nWrote ${targets.length + 1} files to public/icons`);
