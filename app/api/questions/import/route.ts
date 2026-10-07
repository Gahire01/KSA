import { randomBytes } from "node:crypto";

import { guard } from "@/lib/api/guard";
import { clientKey, rateLimit, rateLimitFail } from "@/lib/api/rate-limit";
import { apiFail, apiNotFound, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { requestIp } from "@/lib/exams/attempt";
import { MAX_IMPORT_BYTES, parseCsv, readXlsx, validateRows } from "@/lib/exams/import";

/**
 * POST /api/questions/import (multipart)
 *
 *   courseId  the course the questions belong to
 *   mode      "preview" (default, writes nothing) or "commit"
 *   file      a .csv or .xlsx            -- or --
 *   text      pasted CSV
 *
 * Preview reports how many rows are valid and why the others are not, plus the
 * first ten valid rows. Commit imports the valid rows in ONE transaction: either
 * all of them land or none do. Staff only; the file type is decided by its
 * contents (zip magic bytes), never by its name or declared MIME type.
 */

const PREVIEW_ROWS = 10;
const MAX_ERRORS_RETURNED = 200;
const CHUNK = 1000;

const newId = () => randomBytes(12).toString("hex");

export async function POST(request: Request) {
  const gate = await guard("question.write");
  if (!gate.ok) return gate.response;

  const limit = rateLimit(clientKey(request, "question-import"), 20, 60 * 1000);
  if (!limit.ok) return rateLimitFail(limit.retryAfterSeconds);

  const form = await request.formData().catch(() => null);
  if (!form) return apiFail("Send the questions as a form upload.", 400);

  const courseId = form.get("courseId");
  const mode = form.get("mode") === "commit" ? "commit" : "preview";
  if (typeof courseId !== "string" || !courseId.trim() || courseId.length > 64) {
    return apiFail("Choose a course.", 422);
  }

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true } });
  if (!course) return apiNotFound("Course");

  /* Read the input: a file, or pasted text. */
  let rows: string[][] | null;
  const file = form.get("file");
  const pasted = form.get("text");

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMPORT_BYTES) return apiFail("The file is larger than 5 MB.", 413);
    const bytes = Buffer.from(await file.arrayBuffer());
    const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
    rows = isZip ? readXlsx(bytes) : parseCsv(bytes.toString("utf8"));
    if (!rows) return apiFail("That spreadsheet could not be read. Save it as .xlsx or CSV and try again.", 422);
  } else if (typeof pasted === "string" && pasted.trim()) {
    if (pasted.length > MAX_IMPORT_BYTES) return apiFail("The pasted text is too large.", 413);
    rows = parseCsv(pasted);
  } else {
    return apiFail("Paste CSV text or choose a file.", 422);
  }

  const result = validateRows(rows);
  if ("fatal" in result) return apiFail(result.fatal, 422);

  const summary = {
    total: result.total,
    valid: result.valid.length,
    invalid: result.errors.length,
    errors: result.errors.slice(0, MAX_ERRORS_RETURNED),
    errorsTruncated: result.errors.length > MAX_ERRORS_RETURNED,
  };

  if (mode === "preview") {
    return apiOk({
      ...summary,
      preview: result.valid.slice(0, PREVIEW_ROWS).map((q) => ({
        row: q.row,
        text: q.text,
        difficulty: q.difficulty,
        options: q.options,
        explanation: q.explanation,
      })),
    });
  }

  if (result.valid.length === 0) return apiFail("There are no valid rows to import.", 422);

  try {
    const last = await prisma.question.findFirst({
      where: { courseId: course.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const start = (last?.position ?? 0) + 1;

    const questions = result.valid.map((q, i) => ({
      id: newId(),
      courseId: course.id,
      text: q.text,
      explanation: q.explanation,
      difficulty: q.difficulty,
      position: start + i,
      isActive: true,
    }));
    const options = result.valid.flatMap((q, i) =>
      q.options.map((o, k) => ({
        id: newId(),
        questionId: questions[i].id,
        text: o.text,
        isCorrect: o.isCorrect,
        position: k + 1,
      })),
    );

    /* One batch transaction: all questions and all options, or nothing. */
    const operations = [];
    for (let i = 0; i < questions.length; i += CHUNK) {
      operations.push(prisma.question.createMany({ data: questions.slice(i, i + CHUNK) }));
    }
    for (let i = 0; i < options.length; i += CHUNK) {
      operations.push(prisma.questionOption.createMany({ data: options.slice(i, i + CHUNK) }));
    }
    await prisma.$transaction(operations);

    await prisma.auditLog
      .create({
        data: {
          actorId: gate.session.user.id,
          actorEmail: gate.session.user.email,
          action: "exam.questions.imported",
          entityType: "Course",
          entityId: course.id,
          meta: JSON.stringify({ count: questions.length, skipped: result.errors.length, course: course.name }),
          ip: await requestIp(),
        },
      })
      .catch((error: unknown) => console.error("[question-import] audit write failed", error));

    return apiOk({ ...summary, imported: questions.length }, 201);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2002") {
      return apiFail("Another import changed this course at the same moment. Nothing was imported; try again.", 409);
    }
    return apiFail("The import failed and nothing was saved. Try again.", 500, { logError: error });
  }
}
