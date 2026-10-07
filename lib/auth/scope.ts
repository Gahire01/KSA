import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/** True when `id` is an active TRAINER account, i.e. a valid course assignee. */
export async function isActiveTrainer(id: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
  return Boolean(user && user.role === "TRAINER" && user.isActive);
}

/**
 * Row-level scoping for trainers.
 *
 * A trainer sees and runs only the courses assigned to them, and the trainees,
 * questions, exams and certificates that hang off those courses. Scoping is done in
 * the query itself (a WHERE), never by fetching everything and filtering afterwards,
 * so a trainer's request cannot even load another trainer's rows.
 *
 * `scope` is `gate.trainerScope`: the trainer's user id, or null for owner/admin.
 */

/** WHERE for a Course query. */
export function courseWhere(scope: string | null): Prisma.CourseWhereInput {
  return scope ? { trainerId: scope } : {};
}

/** WHERE for anything with a `course` relation (trainee, exam attempt, certificate). */
export function viaCourse(scope: string | null): { course?: Prisma.CourseWhereInput } {
  return scope ? { course: { trainerId: scope } } : {};
}

/** True when a course (already loaded, with its trainerId) is visible to this scope. */
export function ownsCourse(scope: string | null, course: { trainerId: string | null }): boolean {
  return scope === null || course.trainerId === scope;
}
