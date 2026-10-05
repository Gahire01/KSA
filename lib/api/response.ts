import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: string; requestId?: string };
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export function apiOk<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * Failure envelope.
 *
 * Only the human-readable message and a correlation id reach the client — never
 * a stack trace, a Prisma error code or a driver message. Pass `logError` to
 * record the underlying cause server-side under the same id.
 */
export function apiFail(
  error: string,
  status = 400,
  options: { requestId?: string; logError?: unknown } = {},
): NextResponse<ApiFailure> {
  const requestId = options.requestId ?? randomUUID();

  if (options.logError !== undefined) {
    /* Server-side only. The id ties this line to what the client was told. */
    console.error(`[api:${requestId}] ${error}`, options.logError);
  }

  return NextResponse.json(
    { ok: false, error, requestId },
    { status, headers: { "X-Request-Id": requestId } },
  );
}

export function apiNotFound(what = "Record"): NextResponse<ApiFailure> {
  return apiFail(`${what} not found.`, 404);
}

/** Turns a Zod error into a single human-readable line. */
export function zodMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  ) {
    const issues = (error as { issues: Array<{ message?: string }> }).issues;
    const first = issues[0]?.message;
    if (first) return first;
  }
  return "Some of the submitted values are not valid.";
}
