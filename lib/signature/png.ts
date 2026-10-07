/**
 * Signature image hygiene. No dependency: a PNG is a signature plus a list of
 * length-prefixed chunks, so validating and cleaning one is a short walk.
 *
 * - Magic bytes decide the type, never the filename or client MIME. SVG (which
 *   can carry script) and everything else that is not a PNG is rejected.
 * - Only the chunks needed to draw the picture are kept. EXIF (`eXIf`), text
 *   (`tEXt`/`zTXt`/`iTXt`), timestamps (`tIME`), and any unknown ancillary chunk
 *   are dropped, which strips camera and editor metadata from uploads.
 */

export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 4000;
const MIN_DIMENSION = 50;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "sRGB", "cHRM", "pHYs"]);

export type CleanPng =
  | { ok: true; data: Buffer; width: number; height: number }
  | { ok: false; error: string };

export function cleanPng(input: Buffer): CleanPng {
  if (input.length > MAX_SIGNATURE_BYTES) {
    return { ok: false, error: "The image is larger than 2 MB." };
  }
  if (input.length < 33 || !input.subarray(0, 8).equals(PNG_MAGIC)) {
    return { ok: false, error: "Only PNG images are accepted." };
  }

  const kept: Buffer[] = [PNG_MAGIC];
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;

  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString("latin1", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > input.length) return { ok: false, error: "The PNG file is damaged." };

    if (!sawIhdr) {
      if (type !== "IHDR" || length !== 13) return { ok: false, error: "The PNG file is damaged." };
      width = input.readUInt32BE(offset + 8);
      height = input.readUInt32BE(offset + 12);
      sawIhdr = true;
    }

    if (KEEP.has(type)) {
      kept.push(input.subarray(offset, end));
      if (type === "IDAT") sawIdat = true;
    }
    offset = end;

    if (type === "IEND") {
      sawIend = true;
      break;
    }
  }

  if (!sawIhdr || !sawIdat || !sawIend) return { ok: false, error: "The PNG file is damaged." };
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return { ok: false, error: "The image is too small to be a signature." };
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return { ok: false, error: "The image dimensions are too large (max 4000 px)." };
  }

  return { ok: true, data: Buffer.concat(kept), width, height };
}
