import { clientKey, rateLimit, rateLimitFail } from "@/lib/api/rate-limit";
import { apiOk } from "@/lib/api/response";
import { loadAttemptByToken } from "@/lib/exams/attempt";
import { linkState } from "@/lib/exams/link";
import { readExamSession } from "@/lib/exams/session-cookie";

/**
 * GET /api/exams/attempts/:token/status
 *
 * Lets the exam page show "expired" or "already opened" before asking for a
 * code, instead of after a failed one.
 *
 * `open` is returned for an unknown token as well as a usable one, so this
 * cannot be used to tell which links exist. Only the holder of a real 32-byte
 * token can ever see `expired` or `used`, and those carry no detail beyond
 * the word. A trainee resuming on the tab that already redeemed the code gets
 * `resume` (proved by the signed exam-session cookie).
 */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const limit = rateLimit(clientKey(request, "exam-status"), 60, 60 * 1000);
  if (!limit.ok) return rateLimitFail(limit.retryAfterSeconds);

  const attempt = await loadAttemptByToken(token);
  if (!attempt) return apiOk({ state: "open" as const });

  if (attempt.status === "STARTED" && (await readExamSession(token, attempt.id))) {
    return apiOk({ state: "resume" as const });
  }

  const finished =
    attempt.status === "SUBMITTED" ||
    attempt.status === "PASSED" ||
    attempt.status === "FAILED" ||
    attempt.status === "VOID";
  const state = linkState(attempt);

  if (state === "expired") return apiOk({ state: "expired" as const });
  if (finished || state === "used") return apiOk({ state: "used" as const });
  return apiOk({ state: "open" as const });
}
