/* Deterministic hash — used for avatar colors and content hashes. */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededFromString(value: string): () => number {
  let state = hashString(value) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export function yearOf(value: string | Date = new Date()): number {
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
}

/** KSA-TID-2026-0043 style trainee id derived from the course code. */
export function generateTraineeId(
  courseCode: string,
  sequence: number,
  year = new Date().getFullYear(),
): string {
  const seq = String(sequence).padStart(4, "0");
  return `${courseCode.toUpperCase()}-${year}-${seq}`;
}

/** FIRE-2026-0043 — short human-facing trainee number. */
export function generateTraineeNo(
  courseCode: string,
  sequence: number,
  year = new Date().getFullYear(),
): string {
  return generateTraineeId(courseCode, sequence, year);
}

export function generateCertNo(
  year = new Date().getFullYear(),
  sequence: number,
): string {
  return `KSA-CERT-${year}-${String(sequence).padStart(5, "0")}`;
}

export function generateReceiptNo(
  year = new Date().getFullYear(),
  sequence: number,
): string {
  return `KSA-REC-${year}-${String(sequence).padStart(5, "0")}`;
}

export function generateToken(prefix: string, seed: string): string {
  const rnd = seededFromString(seed);
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i += 1) {
    out += alphabet[Math.floor(rnd() * alphabet.length)];
  }
  return `${prefix}_${out}`;
}

/** Fake but stable 64-char SHA-256-looking content hash. */
export function generateContentHash(seed: string): string {
  const rnd = seededFromString(seed);
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 64; i += 1) {
    out += hex[Math.floor(rnd() * hex.length)];
  }
  return out;
}

export function generateId(prefix: string, index: number): string {
  return `${prefix}_${String(index).padStart(4, "0")}`;
}
