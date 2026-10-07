import { NextResponse } from "next/server";

import { clientKey, rateLimit, rateLimitFail } from "@/lib/api/rate-limit";
import { apiFail } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { loadAttemptByToken } from "@/lib/exams/attempt";
import { readExamSession } from "@/lib/exams/session-cookie";

/** Hard ceiling on stored flags per sitting. */
const MAX_FLAGS = 500;

const INTEGRITY_LIMIT = { max: 30, windowMs: 60 * 1000 } as const;

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
  const b = (body ?? null) as Record<string, unknown> | null;

  const allowed = [
    "blur",
    "focus_blur",
    "too_many_blurs",
    "copy_attempt",
    "cut_attempt",
    "paste_attempt",
    "contextmenu",
    "shortcut",
    "print_attempt",
    "devtools_suspected",
    "tab_switch",
  ];
  const type = b?.type;
  if (typeof type !== "string" || !allowed.includes(type)) {
    return apiFail("Invalid flag type.", 422);
  }

  const flag = { type, at: new Date().toISOString(), reviewed: false };
  const isBlur = type === "blur" || type === "focus_blur";

  /* One atomic statement: a blur and a tab_switch fire together on every tab
   * switch, and a read-then-write of the whole array would lose one of them.
   * Appending with jsonb || is append-only by construction, the blur counter
   * moves in the same statement, and the array is capped so the endpoint cannot
   * be used to grow a row without bound. */
  await prisma.$executeRaw`
    UPDATE "ExamAttempt"
    SET "integrityFlags" = COALESCE("integrityFlags", '[]'::jsonb) || ${JSON.stringify([flag])}::jsonb,
        "blurCount" = "blurCount" + ${isBlur ? 1 : 0}
    WHERE "id" = ${attempt.id}
      AND jsonb_array_length(COALESCE("integrityFlags", '[]'::jsonb)) < ${MAX_FLAGS}
  `;

  return NextResponse.json({ ok: true, data: { recorded: true } });
}
