import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Question banks, kept as the plain text the client sent so the wording stays
 * byte-for-byte theirs. One block per question:
 *
 *   12. Question text
 *   A. ...
 *   B. ...
 *   C. ...
 *   D. ...
 *   Answer: B
 *
 * The parser is strict on purpose: a typo in a bank fails the seed loudly instead
 * of silently publishing an exam with no correct answer.
 */

export interface SeedQuestion {
  text: string;
  options: [string, string, string, string];
  /** Index into `options`. */
  correctIndex: 0 | 1 | 2 | 3;
}

/** Which bank feeds which course. FIRST has none yet: the client sends its own set later. */
export const QUESTION_BANKS: Record<string, { file: string; expected: number } | undefined> = {
  CONSTRUCT: { file: "construct.txt", expected: 30 },
  OSH: { file: "osh.txt", expected: 30 },
  /* The client bundled fire fighting (15) and first aid (15) in one file. */
  FIRE: { file: "fire.txt", expected: 30 },
  RIGGER: { file: "rigger.txt", expected: 30 },
};

const LETTERS = ["A", "B", "C", "D"] as const;

export function parseQuestions(raw: string, label: string): SeedQuestion[] {
  const blocks = raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim());
    const where = `${label} question ${index + 1}`;
    if (lines.length !== 6) throw new Error(`${where}: expected 6 lines, found ${lines.length}.`);

    const head = /^(\d+)\.\s+(.+)$/.exec(lines[0] ?? "");
    if (!head) throw new Error(`${where}: the first line must look like "12. Question text".`);
    if (Number(head[1]) !== index + 1) {
      throw new Error(`${where}: numbered ${head[1]}; the bank must run 1, 2, 3 without gaps.`);
    }

    const options = LETTERS.map((letter, i) => {
      const match = new RegExp(`^${letter}\\.\\s+(.+)$`).exec(lines[i + 1] ?? "");
      if (!match) throw new Error(`${where}: option ${letter} is missing or malformed.`);
      return (match[1] as string).trim();
    }) as SeedQuestion["options"];

    const answer = /^Answer:\s*([ABCD])$/.exec(lines[5] ?? "");
    if (!answer) throw new Error(`${where}: the last line must be "Answer: A" to "Answer: D".`);

    return {
      text: (head[2] as string).trim(),
      options,
      correctIndex: LETTERS.indexOf(answer[1] as (typeof LETTERS)[number]) as SeedQuestion["correctIndex"],
    };
  });
}

export function loadQuestionBank(courseCode: string): SeedQuestion[] {
  const bank = QUESTION_BANKS[courseCode];
  if (!bank) return [];

  const raw = readFileSync(join(process.cwd(), "prisma", "seed-data", "questions", bank.file), "utf8");
  const questions = parseQuestions(raw, bank.file);

  if (questions.length !== bank.expected) {
    throw new Error(`${bank.file}: expected ${bank.expected} questions, found ${questions.length}.`);
  }
  const texts = new Set(questions.map((q) => q.text));
  if (texts.size !== questions.length) throw new Error(`${bank.file}: contains a duplicated question.`);

  return questions;
}
