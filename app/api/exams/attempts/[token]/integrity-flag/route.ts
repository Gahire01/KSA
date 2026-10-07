import { NextResponse } from "next/server";

import { clientKey, rateLimit, rateLimitFail } from "@/lib/api/rate-limit";
import { apiFail } from "@/lib/api/response";
import { loadAttemptByToken } from "@/lib/exams/attempt";
import { finalizeAttempt } from "@/lib/exams/finalize";
import { appendIntegrityFlag } from "@/lib/exams/flags";
import { readExamSession } from "@/lib/exams/session-cookie";

const INTEGRITY_LIMIT = { max: 30, windowMs: 60 * 1000 } as const;

/** More than this many focus losses ends the sitting. */
const MAX_BLURS = 5;

/**
 * Flag types the runner may report. `too_many_blurs` is deliberately absent: only
 * the server writes it, when it ends a sitting for exceeding MAX_BLURS.
 */
const CLIENT_FLAG_TYPES = [
  "blur",
  "focus_blur",
  "copy_attempt",
  "cut_attempt",
  "paste_attempt",
  "contextmenu",
  "shortcut",
  "print_attempt",
  "devtools_suspected",
  "tab_switch",
];

/**
 * POST /api/exams/attempts/:token/integrity-flag { type }
 *
 * The runner reports something worth a human's attention. Rate limited 30 a
 * minute per token. The server owns the focus-loss rule: when the blur count
 * passes MAX_BLURS the sitting is graded and closed here, so a client that is
 * patched to skip its own auto-submit gains nothing.
 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const limit = rateLimit("exam-integrity:" + token, INTEGRITY_LIMIT.max, INTEGRITY_LIMIT.windowMs);
  if (!limit.ok) return rateLimitFail(limit.retryAfterSeconds);

  const ipLimit = rateLimit(
    clientKey(request, "exam-integrity-ip"),
    INTEGRITY_LIMIT.max * 4,
    INTEGRITY_LIMIT.windowMs,
  );
  if (!ipLimit.ok) return rateLimitFail(ipLimit.retryAfterSeconds);

  const attempt = await loadAttemptByToken(token);
  if (!attempt) return apiFail("Enter the code we emailed you to open this exam.", 401);

  /* Cookie before status, so someone holding only a link learns nothing about
   * the sitting's state. */
  if (!(await readExamSession(token, attempt.id))) {
    return apiFail("Enter the code we emailed you to open this exam.", 401);
  }
  if (attempt.status !== "STARTED") return apiFail("This exam is not open.", 410);

  const body: unknown = await request.json().catch(() => null);
  const type = (body as { type?: unknown } | null)?.type;
  if (typeof type !== "string" || !CLIENT_FLAG_TYPES.includes(type)) {
    return apiFail("Invalid flag type.", 422);
  }

  const isBlur = type === "blur" || type === "focus_blur";
  const blurCount = await appendIntegrityFlag(attempt.id, type, { countsAsBlur: isBlur });

  if (isBlur && blurCount !== null && blurCount > MAX_BLURS) {
    const result = await finalizeAttempt(attempt, { token, autoFlag: "too_many_blurs" });
    if (result.ok) {
      return NextResponse.json({ ok: true, data: { recorded: true, autoSubmitted: true, result: result.data } });
    }
  }

  return NextResponse.json({ ok: true, data: { recorded: true, blurCount } });
}
