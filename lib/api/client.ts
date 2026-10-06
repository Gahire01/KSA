/**
 * Thin fetch wrapper for the Phase 1 API.
 *
 * Every route answers with `{ ok: true, data }` or `{ ok: false, error }`, so
 * this unwraps `data` and turns the failure branch into an `ApiError` the hooks
 * can surface in a toast.
 */

export class ApiError extends Error {
  readonly status: number;
  /** Parsed `Retry-After` on a 429, so a caller can count the wait down. */
  readonly retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** True when the caller should be bounced to the sign-in page. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** True when the session exists but the second factor is still outstanding. */
  get needsMfa(): boolean {
    return this.status === 403;
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection.", 0);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new ApiError("The server sent an unreadable response.", response.status);
  }

  const envelope = body as Partial<Envelope<T>>;

  if (!response.ok || envelope?.ok !== true) {
    const message =
      envelope && envelope.ok === false && typeof envelope.error === "string"
        ? envelope.error
        : `Request failed (${response.status}).`;

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : null;

    throw new ApiError(
      message,
      response.status,
      retryAfterSeconds !== null && Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
    );
  }

  return envelope.data as T;
}

function withQuery(path: string, query?: Record<string, unknown>): string {
  if (!query) return path;

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;

    /* Arrays become CSV so multi-select filters round-trip in one parameter. */
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params.set(key, value.map(String).join(","));
      continue;
    }

    params.set(key, String(value));
  }

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) =>
    request<T>(withQuery(path, query)),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
