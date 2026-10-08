/**
 * Generates public/og-image.png (1200x630) from public/logo.png and
 * recompresses public/logo.png in place (palette PNG, quality 80).
 *
 * Run with: node scripts/gen-og.mjs
 * Dev-only: the outputs are committed, so a fresh checkout builds without it.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "..", "public");
const logoPath = path.join(publicDir, "logo.png");

const logoSource = await readFile(logoPath);

const logo = await sharp(logoSource).resize(260, 260, { fit: "cover" }).png().toBuffer();

const text = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <text x="600" y="470" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700" fill="#FFFFFF">KIGALI SAFETY ACADEMY</text>
    <text x="600" y="530" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#C9D3E3">Training, examination and certification for safer sites</text>
  </svg>`,
);

const og = await sharp({
  create: { width: 1200, height: 630, channels: 4, background: "#0F2340" },
})
  .composite([
    { input: logo, left: 470, top: 90 },
    { input: text, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(path.join(publicDir, "og-image.png"), og);
console.log(`og-image.png  1200x630  ${og.length} B`);

/* Same pixel dimensions, so every consumer (emails, header, certificates)
 * renders identically; only the byte size drops. */
const slim = await sharp(logoSource).png({ palette: true, quality: 80, compressionLevel: 9 }).toBuffer();
if (slim.length < logoSource.length) {
  await writeFile(logoPath, slim);
  console.log(`logo.png  ${logoSource.length} B -> ${slim.length} B`);
} else {
  console.log(`logo.png left as is (${logoSource.length} B)`);
}
