import { seededFromString } from "./ids";

/**
 * Deterministic Fisher–Yates shuffle. The same seed always produces the
 * same order, so the exam preview and the real exam runner agree.
 */
export function shuffle<T>(items: readonly T[], seed: string): T[] {
  const rnd = seededFromString(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const a = out[i];
    const b = out[j];
    out[i] = b as T;
    out[j] = a as T;
  }
  return out;
}

export function pickOne<T>(items: readonly T[], seed: string): T {
  const rnd = seededFromString(seed);
  return items[Math.floor(rnd() * items.length)] as T;
}

export function pickMany<T>(items: readonly T[], count: number, seed: string): T[] {
  return shuffle(items, seed).slice(0, Math.max(0, Math.min(count, items.length)));
}
