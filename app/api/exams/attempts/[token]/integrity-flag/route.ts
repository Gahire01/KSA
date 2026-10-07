import { NextResponse } from "next/server";

import { clientKey, rateLimit, rateLimitFail } from "@/lib/api/rate-limit";
import { apiFail } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { loadAttemptByToken } from "@/lib/exams/attempt";
import { readExamSession } from "@/lib/exams/session-cookie";

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
  if (!attempt) return apiFail("This exam link is not valid.", 404);
  if (attempt.status !== "STARTED") return apiFail("This exam is not open.", 410);

  if (!(await readExamSession(token, attempt.id))) {
    return apiFail("Enter the code we emailed you to open this exam.", 401);
  }

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

  const existing = Array.isArray(attempt.integrityFlags)
    ? (attempt.integrityFlags as Array<{ type: string; at: string; reviewed?: boolean }>)
    : [];
  /* Append-only: a flag can be added but never removed by the client. */
  const flags = [...existing, { type, at: new Date().toISOString(), reviewed: false }];
  const isBlur = type === "blur" || type === "focus_blur";

  await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      integrityFlags: flags,
      ...(isBlur ? { blurCount: { increment: 1 } } : {}),
    },
  });

  return NextResponse.json({ ok: true, data: { recorded: true } });
}
