import { clientKey, rateLimit, rateLimitFail } from "@/lib/api/rate-limit";
import { apiFail, apiOk } from "@/lib/api/response";
import { loadAttemptByToken, secondsRemaining } from "@/lib/exams/attempt";
import { readExamSession } from "@/lib/exams/session-cookie";

/**
 * GET /api/exams/attempts/:token/time
 *
 * The server's view of the clock. The runner polls this every 30 seconds and
 * re-syncs its countdown, so a changed system clock cannot buy time. Same
 * gating as the rest of the runner: no cookie, same answer as an unknown token.
 */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const limit = rateLimit(clientKey(request, "exam-time"), 120, 60 * 1000);
  if (!limit.ok) return rateLimitFail(limit.retryAfterSeconds);

  const attempt = await loadAttemptByToken(token);
  if (!attempt || !(await readExamSession(token, attempt.id))) {
    return apiFail("Enter the code we emailed you to open this exam.", 401);
  }
  if (attempt.status !== "STARTED") return apiFail("This exam is not open.", 410);

  return apiOk({ secondsRemaining: secondsRemaining(attempt) }, 200, { "Cache-Control": "no-store" });
}
