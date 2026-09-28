/* Generates the placeholder transparent stamp + signature PNGs used by
   the certificate template and trainer profile. Run: node scripts/gen-assets.mjs */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "public");
mkdirSync(outDir, { recursive: true });

/* ── Minimal PNG encoder (8-bit RGBA) ─────────────────────────── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── Tiny canvas helpers ──────────────────────────────────────── */
function canvas(w, h) {
  const data = Buffer.alloc(w * h * 4);
  return {
    w,
    h,
    data,
    blend(x, y, [r, g, b], a) {
      if (a <= 0 || x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      const da = data[i + 3] / 255;
      const outA = a + da * (1 - a);
      if (outA === 0) return;
      data[i] = Math.round((r * a + data[i] * da * (1 - a)) / outA);
      data[i + 1] = Math.round((g * a + data[i + 1] * da * (1 - a)) / outA);
      data[i + 2] = Math.round((b * a + data[i + 2] * da * (1 - a)) / outA);
      data[i + 3] = Math.round(outA * 255);
    },
    stroke(points, width, color, alpha = 1) {
      for (let i = 1; i < points.length; i += 1) {
        const [x0, y0] = points[i - 1];
        const [x1, y1] = points[i];
        const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
        for (let s = 0; s <= steps; s += 1) {
          const t = s / steps;
          const px = x0 + (x1 - x0) * t;
          const py = y0 + (y1 - y0) * t;
          const r = width / 2;
          for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy += 1) {
            for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx += 1) {
              const d = Math.hypot(dx, dy);
              if (d <= r + 0.5) {
                this.blend(Math.round(px + dx), Math.round(py + dy), color, alpha);
              }
            }
          }
        }
      }
    },
    ring(cx, cy, radius, width, color, alpha = 1) {
      const steps = Math.round(radius * 24);
      for (let i = 0; i < steps; i += 1) {
        const a = (i / steps) * Math.PI * 2;
        this.stroke(
          [
            [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius],
            [cx + Math.cos(a) * (radius + width / 2), cy + Math.sin(a) * (radius + width / 2)],
          ],
          width,
          color,
          alpha,
        );
      }
    },
  };
}

/* ── Signature: flowing ink strokes ───────────────────────────── */
function signature() {
  const W = 520;
  const H = 170;
  const c = canvas(W, H);
  const ink = [15, 35, 64];

  const curves = [
    // big M-like entry
    [[26, 118], [52, 44], [74, 42], [78, 112]],
    [[78, 112], [86, 60], [100, 40], [116, 74], [126, 112]],
    [[126, 112], [138, 96], [146, 92], [152, 96]],
    // flowing middle
    [[152, 96], [172, 128], [196, 128], [206, 100], [214, 70]],
    [[214, 70], [220, 104], [230, 126], [242, 116], [252, 84]],
    [[252, 84], [262, 62], [274, 60], [282, 80], [286, 108]],
    // trailing flourish
    [[286, 108], [300, 132], [330, 140], [368, 132], [404, 120], [438, 116], [468, 122], [492, 118]],
  ];

  for (const pts of curves) {
    // smooth the polyline into a bezier-ish curve
    const smooth = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let t = 0; t < 1; t += 0.02) {
        const mt = 1 - t;
        const x =
          mt * mt * mt * p0[0] +
          3 * mt * mt * t * p1[0] +
          3 * mt * t * t * p2[0] +
          t * t * t * p3[0];
        const y =
          mt * mt * mt * p0[1] +
          3 * mt * mt * t * p1[1] +
          3 * mt * t * t * p2[1] +
          t * t * t * p3[1];
        smooth.push([x, y]);
      }
    }
    smooth.push(pts[pts.length - 1]);
    c.stroke(smooth, 5.5, ink, 0.92);
  }

  // underline flourish
  c.stroke(
    [
      [40, 146],
      [150, 152],
      [300, 150],
      [440, 144],
      [486, 148],
    ],
    3,
    ink,
    0.7,
  );

  return encodePng(W, H, c.data);
}

/* ── Stamp: twin ring + radial ticks + centre mark ────────────── */
function stamp() {
  const S = 460;
  const c = canvas(S, S);
  const cx = S / 2;
  const cy = S / 2;
  const red = [178, 58, 46];

  c.ring(cx, cy, 196, 7, red, 0.85);
  c.ring(cx, cy, 176, 3, red, 0.7);

  // radial ticks around the inner band
  for (let i = 0; i < 72; i += 1) {
    const a = (i / 72) * Math.PI * 2 - Math.PI / 2;
    const long = i % 6 === 0;
    const r0 = 150;
    const r1 = long ? 172 : 162;
    c.stroke(
      [
        [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0],
        [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1],
      ],
      long ? 4 : 2.5,
      red,
      0.8,
    );
  }

  // inner ring
  c.ring(cx, cy, 122, 4, red, 0.78);

  // abstract "KSA" monogram strokes
  c.stroke(
    [
      [cx - 52, cy + 44],
      [cx - 52, cy - 46],
      [cx - 12, cy + 8],
    ],
    9,
    red,
    0.82,
  );
  c.stroke(
    [
      [cx - 12, cy + 8],
      [cx - 54, cy + 48],
      [cx - 4, cy + 48],
    ],
    9,
    red,
    0.82,
  );
  c.stroke(
    [
      [cx + 16, cy - 46],
      [cx + 16, cy + 48],
    ],
    9,
    red,
    0.82,
  );
  c.stroke(
    [
      [cx + 16, cy - 46],
      [cx + 56, cy - 20],
      [cx + 20, cy + 6],
      [cx + 60, cy + 48],
    ],
    9,
    red,
    0.82,
  );

  // small banner under the monogram
  c.stroke(
    [
      [cx - 74, cy + 74],
      [cx + 74, cy + 74],
    ],
    5,
    red,
    0.7,
  );

  return encodePng(S, S, c.data);
}

writeFileSync(resolve(outDir, "signature-sample.png"), signature());
writeFileSync(resolve(outDir, "stamp-sample.png"), stamp());
console.log("wrote signature-sample.png and stamp-sample.png");
