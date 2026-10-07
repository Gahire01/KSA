import { NextResponse } from "next/server";

import { examSubmitSchema } from "@/lib/api/exam-schemas";
import { apiFail, zodMessage } from "@/lib/api/response";
import { loadAttemptByToken } from "@/lib/exams/attempt";
import { finalizeAttempt, recordedResult } from "@/lib/exams/finalize";
import { readExamSession } from "@/lib/exams/session-cookie";

/**
 * POST /api/exams/attempts/:token/submit
 *
 * Grades the paper once, server-side, and issues a certificate on a pass (see
 * lib/exams/finalize.ts). A failed first attempt automatically emails the next
 * one.
 *
 * Time: answers are only accepted until the clock plus a 30 second grace (see
 * the answer route), so a late submit grades exactly what was saved in time and
 * is flagged `late_submit` for staff, rather than being refused and stranding
 * the trainee's work.
 */

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const attempt = await loadAttemptByToken(token);
  if (!attempt) return apiFail("This exam link is not valid.", 404);

  /* Idempotent: a second submit reports the recorded result rather than
   * regrading, so a double-tapped submit button cannot change the outcome. */
  if (attempt.status !== "STARTED") {
    if (attempt.status === "SUBMITTED" || attempt.status === "PASSED" || attempt.status === "FAILED") {
      const recorded = await recordedResult(attempt);
      return recorded.ok ? NextResponse.json({ ok: true, data: recorded.data }) : apiFail(recorded.error, recorded.status);
    }
    return apiFail("This exam is not open.", 410);
  }

  if (!(await readExamSession(token, attempt.id))) {
    return apiFail("Enter the code we emailed you to open this exam.", 401);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = examSubmitSchema.safeParse(body ?? {});
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  /* Any blurCount in the body is ignored; see the answer route. */
  const result = await finalizeAttempt(attempt, { token });
  return result.ok ? NextResponse.json({ ok: true, data: result.data }) : apiFail(result.error, result.status);
}
