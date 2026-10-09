import { createHash, createHmac } from "node:crypto";

/**
 * The exam manifest is the frozen question order for one sitting.
 *
 * It is stored as canonical JSON on the attempt so the paper the trainee sees
 * cannot be reshuffled by a reload, and so grading reads exactly the questions
 * that were asked.
 *
 * CRITICALLY the manifest holds ids only — never `isCorrect`. It is returned to
 * the browser verbatim by /api/exams/attempts/[token]/verify-otp, so anything
 * that marks an option as correct must stay server-side.
 */

export interface ManifestQuestion {
  questionId: string;
  /** Option ids in the order this sitting presents them. */
  optionIds: string[];
}

export interface ExamManifest {
  version: 1;
  courseId: string;
  questionIds: string[];
  questions: ManifestQuestion[];
}

interface ManifestInputQuestion {
  id: string;
  options: Array<{ id: string }>;
}

/**
 * CSPRNG seeded from the attempt token.
 *
 * `seededFromString` in lib/utils/ids.ts is an xorshift over an FNV hash — fine
 * for shuffling mock data in the browser, but this decides a graded paper, so
 * it is backed by HMAC-SHA256 keyed on the token instead. The seed is never
 * guessable before the token is emailed, and the order cannot be recomputed
 * without it.
 */
function csprngFromToken(token: string): () => number {
  let counter = 0;
  let buffer = Buffer.alloc(0);
  let offset = 0;

  return () => {
    if (offset + 4 > buffer.length) {
      const block = createHmac("sha256", token)
        .update(`manifest:${counter}`)
        .digest();
      counter += 1;
      buffer = block;
      offset = 0;
    }

    const value = buffer.readUInt32BE(offset) / 0x1_0000_0000;
    offset += 4;
    return value;
  };
}

/** Fisher–Yates driven by the token-seeded CSPRNG. */
function shuffleWith(rnd: () => number, items: readonly string[]): string[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const a = out[i] as string;
    const b = out[j] as string;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** The real thing: shuffles both questions and their options. */
export function buildExamManifest(
  courseId: string,
  questions: ManifestInputQuestion[],
  token: string,
): ExamManifest {
  const rnd = csprngFromToken(token);
  const ordered = shuffleWith(
    rnd,
    questions.map((q) => q.id),
  );
  const byId = new Map(questions.map((q) => [q.id, q]));

  return {
    version: 1,
    courseId,
    questionIds: ordered,
    questions: ordered.map((questionId) => {
      const question = byId.get(questionId);
      const options = question ? question.options.map((o) => o.id) : [];
      return { questionId, optionIds: shuffleWith(rnd, options) };
    }),
  };
}

/**
 * Canonical JSON: keys sorted at every level so the same snapshot always
 * hashes to the same digest.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    .join(",")}}`;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Tolerant parse — a malformed stored manifest must not 500 the exam page. */
export function parseManifest(raw: string): ExamManifest | null {
  try {
    const parsed = JSON.parse(raw) as ExamManifest;
    if (!parsed || !Array.isArray(parsed.questionIds) || !Array.isArray(parsed.questions)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}