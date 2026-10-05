import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

/**
 * argon2id at the cost profile agreed for KSA: 19 MiB, 2 passes, 1 lane.
 * These are the OWASP-recommended minimums, so do not lower them.
 *
 * `algorithm` is deliberately omitted: `@node-rs/argon2` exposes `Algorithm` as
 * an ambient const enum, which cannot be referenced under `isolatedModules`,
 * and argon2id is already that package's documented default. The smoke test in
 * HANDOFF asserts the resulting hashes really do start with `$argon2id$`.
 */
const ARGON_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON_OPTIONS);
}

/**
 * Returns false rather than throwing: a malformed stored hash must not be able
 * to turn into a 500 on the login route.
 */
export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argonVerify(passwordHash, password);
  } catch {
    return false;
  }
}
