import { NextResponse } from "next/server";

import { clientKey, rateLimit, rateLimitFail } from "@/lib/api/rate-limit";
import { apiFail } from "@/lib/api/response";
import { loadAttemptByToken } from "@/lib/exams/attempt";
import { finalizeAttempt } from "@/lib/exams/finalize";
import { appendIntegrityFlag } from "@/lib/exams/flags";
import { TAB_LEAVE_FAIL_AT } from "@/lib/exams/rules";
import { readExamSession } from "@/lib/exams/session-cookie";

const INTEGRITY_LIMIT = { max: 30, windowMs: 60 * 1000 } as const;

/**
 * Flag types the runner may report. `tab_leave_fail` is deliberately absent: only
 * the server writes it, when it ends a sitting on the second tab leave.
 */
const CLIENT_FLAG_TYPES = [
  "tab_leave",
  "copy_attempt",
  "cut_attempt",
  "paste_attempt",
  "contextmenu",
  "shortcut",
  "print_attempt",
  "devtools_suspected",
];

/**
 * POST /api/exams/attempts/:token/integrity-flag { type }
 *
 * The runner reports something worth a human's attention. Rate limited 30 a
 * minute per token. The server owns the tab-leave rule: the first leave is a
 * warning, and on the second the sitting is graded as FAILED and closed here, so
 * a client that is patched to skip its own handling gains nothing.
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

  const isLeave = type === "tab_leave";
  const leaveCount = await appendIntegrityFlag(attempt.id, type, { countsAsBlur: isLeave });

  if (isLeave && leaveCount !== null && leaveCount >= TAB_LEAVE_FAIL_AT) {
    const result = await finalizeAttempt(attempt, { token, autoFlag: "tab_leave_fail" });
    /* Only claim the auto-submit when this request actually ended the sitting. If the
     * trainee's own submit won the race, `alreadySubmitted` is set and they are shown
     * their normal result instead of a message about leaving the window. */
    if (result.ok && !result.data.alreadySubmitted) {
      return NextResponse.json({ ok: true, data: { recorded: true, autoSubmitted: true, result: result.data } });
    }
  }

  return NextResponse.json({ ok: true, data: { recorded: true, blurCount: leaveCount } });
}
