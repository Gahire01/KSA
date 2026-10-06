/**
 * Generates the PWA icon set from public/logo.svg.
 *
 * Run with: node scripts/gen-icons.mjs
 *
 * The set is derived from one source rather than hand-exported from a design
 * file, so re-colouring the logo means re-running this instead of re-exporting
 * six assets. Dev-only: the PNGs are committed, so a fresh checkout builds
 * without running it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = path.join(root, "public", "icons");

const NAVY = "#0F2340";
const ORANGE = "#E85D25";

/** Everything inside the logo except its background square, in a 48-unit box. */
const GLYPH = `
  <path d="M12 34.5V13.5h3.6v9.1L23.4 13.5h4.6l-8.2 9.6 8.7 11.4h-4.8l-6.3-8.4-1.8 2.1v6.3H12Z" fill="#FFFFFF"/>
  <path d="M28.6 13.5h3.5v13.1h7.1v3.4h-10.6V13.5Z" fill="${ORANGE}"/>
  <rect x="12" y="38.6" width="26" height="1.8" rx="0.9" fill="${ORANGE}" opacity="0.55"/>
`;

/**
 * A standard icon: the logo exactly as it ships, rounded corners and all.
 * Chromium accepts these for both `any` and `maskable`, but `maskable` would
 * crop the corners — which is why the maskable variant below drops them.
 */
function standardSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="11" fill="${NAVY}"/>
  ${GLYPH}
</svg>`;
}

/**
 * A maskable icon: full-bleed square (Android masks to a circle, so a rounded
 * or transparent corner would show the backdrop) with the glyph scaled to sit
 * inside the 80% safe zone. The spec's safe zone is a centred circle at 40% of
 * the width, so the glyph is held to ~64% and the corners are square.
 */
function maskableSvg(size) {
  const scale = 0.64;
  const offset = (48 - 48 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="${NAVY}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${GLYPH}</g>
</svg>`;
}

const targets = [
  { name: "icon-192.png", size: 192, svg: standardSvg },
  { name: "icon-512.png", size: 512, svg: standardSvg },
  { name: "maskable-192.png", size: 192, svg: maskableSvg },
  { name: "maskable-512.png", size: 512, svg: maskableSvg },
  { name: "apple-touch-icon.png", size: 180, svg: maskableSvg },
  { name: "icon-96.png", size: 96, svg: standardSvg },
  { name: "favicon-48.png", size: 48, svg: standardSvg },
  { name: "favicon-32.png", size: 32, svg: standardSvg },
  { name: "favicon-16.png", size: 16, svg: standardSvg },
];

await mkdir(outDir, { recursive: true });

for (const target of targets) {
  const svg = target.svg(target.size);
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(outDir, target.name), png);
  console.log(`${target.name}  ${target.size}x${target.size}  ${png.length} B`);
}

/* The SVG favicon is the logo itself — sharpest at any zoom and what the
 * manifest's `"sizes": "any"` entry points at. */
const logo = await readFile(path.join(root, "public", "logo.svg"), "utf8");
await writeFile(path.join(outDir, "icon.svg"), logo);
console.log("icon.svg");

console.log(`\nWrote ${targets.length + 1} files to public/icons`);
