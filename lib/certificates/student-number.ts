import { prisma } from "@/lib/db";
import register from "../../scripts/student-list/student-numbers.json";

/**
 * Student numbers.
 *
 * The academy's register (public/student, parsed into
 * scripts/student-list/student-numbers.json) is the source of truth for the
 * numbers already handed out. A certificate prints the number the student already
 * has; only someone with no number gets the next free one.
 */

/**
 * Lowercase, accents stripped, punctuation dropped, words sorted. "Gatete Eraste"
 * and "ERASTE  gatete" are the same person; the manifest stores the same form.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

const byName = new Map<string, number>();
for (const student of register.students as Array<{ number: number; normalized: string }>) {
  if (!byName.has(student.normalized)) byName.set(student.normalized, student.number);
}

/** The register number for a name, or null when the name is not on the register. */
export function registerNumberFor(name: string): number | null {
  return byName.get(normalizeName(name)) ?? null;
}

/**
 * The number this trainee should have on their certificate, if they have one and
 * it is free: first their own numeric trainee number, then a register match by
 * name. Null means "allocate the next number". A number already printed on
 * another certificate is never reused (the column is unique).
 */
export async function preferredStudentNumber(trainee: {
  traineeNo: string;
  fullName: string;
}): Promise<number | null> {
  const candidates: number[] = [];

  if (/^\d{1,9}$/.test(trainee.traineeNo)) {
    candidates.push(Number.parseInt(trainee.traineeNo, 10));
  }
  const fromRegister = registerNumberFor(trainee.fullName);
  if (fromRegister !== null) candidates.push(fromRegister);

  const unique = [...new Set(candidates)].filter((n) => n > 0);
  if (unique.length === 0) return null;

  const taken = await prisma.certificate.findMany({
    where: { studentNumber: { in: unique } },
    select: { studentNumber: true },
  });
  const takenSet = new Set(taken.map((t) => t.studentNumber));

  return unique.find((n) => !takenSet.has(n)) ?? null;
}
