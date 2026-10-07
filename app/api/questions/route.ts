import { NextResponse } from "next/server";

import { guard } from "@/lib/api/guard";
import { questionCreateSchema } from "@/lib/api/exam-schemas";
import { apiFail, apiNotFound, apiOk, zodMessage } from "@/lib/api/response";
import { actorOf, audit } from "@/lib/audit";
import { ownsCourse } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";

/**
 * GET /api/questions?courseId=… — the question bank for one course.
 *
 * `isCorrect` IS returned here, but only to authenticated staff who are setting
 * the paper — it is how they mark the right answer. It is never returned on any
 * route a trainee can reach.
 */

export async function GET(request: Request) {
  const gate = await guard("question.read", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim();

  if (!courseId || courseId.length > 64) return apiFail("Choose a course.", 422);

  /* A trainer reads the bank of their own courses only. */
  const owned = await prisma.course.findUnique({ where: { id: courseId }, select: { trainerId: true } });
  if (!owned || !ownsCourse(gate.trainerScope, owned)) return apiNotFound("Course");

  const questions = await prisma.question.findMany({
    where: { courseId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      text: true,
      explanation: true,
      position: true,
      isActive: true,
      options: {
        orderBy: { position: "asc" },
        select: { id: true, text: true, isCorrect: true },
      },
    },
  });

  return apiOk({
    items: questions,
    total: questions.length,
    courseId,
  });
}

export async function POST(request: Request) {
  const gate = await guard("question.write", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = questionCreateSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const { courseId, text, explanation, options, isActive } = parsed.data;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, trainerId: true },
  });
  if (!course || !ownsCourse(gate.trainerScope, course)) return apiFail("That course does not exist.", 404);

  /* Position continues the existing sequence rather than restarting at 1, so
   * the (courseId, position) unique index holds. */
  const last = await prisma.question.findFirst({
    where: { courseId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const question = await prisma.question.create({
    data: {
      courseId,
      text,
      explanation: explanation ?? null,
      position: (last?.position ?? 0) + 1,
      isActive: isActive ?? true,
      options: {
        create: options.map((option, index) => ({
          text: option.text,
          isCorrect: option.isCorrect,
          position: index + 1,
        })),
      },
    },
    select: {
      id: true,
      text: true,
      explanation: true,
      position: true,
      isActive: true,
      options: {
        orderBy: { position: "asc" },
        select: { id: true, text: true, isCorrect: true },
      },
    },
  });

  await audit({
    ...actorOf(gate.session),
    action: "question.create",
    entityType: "Question",
    entityId: question.id,
    meta: { courseId },
  });

  return NextResponse.json({ ok: true, data: question }, { status: 201 });
}