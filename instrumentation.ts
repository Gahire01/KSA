export async function register() {
  /* Node runtime only: the edge runtime (middleware) has no full process.env
   * and does not need the server secrets. Skipped during `next build`. */
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertEnv } = await import("@/lib/env");
  assertEnv();
}
