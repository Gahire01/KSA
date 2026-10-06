import { argon2id } from "hash-wasm";
import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * argon2id at the cost profile agreed for KSA: 19 MiB, 2 passes, 1 lane.
 * These are the OWASP-recommended minimums, so do not lower them.
 *
 * Implemented by `hash-wasm` (pure WASM) rather than `@node-rs/argon2`, whose
 * native `.node` binary is blocked by Windows Application Control policy and
 * made local dev on Windows impossible. The output is the same PHC string
 * (`$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`), so hashes written by the
 * old native library still verify unchanged — the smoke test's owner row is
 * hashed by `@node-rs/argon2` and signs in through this code.
 */
export const ARGON_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** 16-byte salt, matching `@node-rs/argon2`'s default. */
const SALT_BYTES = 16;
const HASH_BYTES = 32;

/** Version byte 0x13 = 19, the only version argon2id has ever shipped. */
const PHC_VERSION = 19;

/* A malformed stored hash must still cost a full derivation: the login route
 * calls `verifyPassword("argon2id$placeholder", ...)` for an unknown address
 * precisely so a missing account cannot be told apart from a wrong password by
 * timing. Returning early on the parse failure would leak that. */
const DUMMY_SALT = new Uint8Array(SALT_BYTES);

interface ParsedHash {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  salt: Uint8Array;
  digest: Uint8Array;
}

function toBytes(b64: string): Uint8Array {
  /* Node accepts unpadded base64, which is what argon2's PHC encoding emits. */
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/**
 * Parses the PHC encoding emitted by `hashPassword`.
 *
 * Returns null rather than throwing: callers treat "not a hash we understand"
 * as a failed verification, never as an error that may reach the client.
 */
function parsePhc(encoded: string): ParsedHash | null {
  const parts = encoded.split("$");
  /* ["", "argon2id", "v=19", "m=..,t=..,p=..", salt, hash] */
  if (parts.length !== 6 || parts[0] !== "" || parts[1] !== "argon2id") return null;
  if (parts[2] !== `v=${PHC_VERSION}`) return null;

  const params = new Map<string, number>();
  for (const kv of parts[3].split(",")) {
    const [k, v] = kv.split("=");
    const n = Number(v);
    if (!Number.isInteger(n)) return null;
    params.set(k, n);
  }

  const memoryCost = params.get("m");
  const timeCost = params.get("t");
  const parallelism = params.get("p");
  if (!memoryCost || !timeCost || !parallelism) return null;

  /* Bounds so a corrupted or tampered row cannot ask the server for an
   * unbounded derivation. The real values sit far inside these. */
  if (memoryCost < 8 * parallelism || memoryCost > 4_194_304) return null;
  if (timeCost < 1 || timeCost > 16) return null;
  if (parallelism < 1 || parallelism > 8) return null;

  const salt = toBytes(parts[4]);
  const digest = toBytes(parts[5]);
  if (salt.length < 8 || digest.length !== HASH_BYTES) return null;

  return { memoryCost, timeCost, parallelism, salt, digest };
}

function encodePhc(salt: Uint8Array, digest: Uint8Array): string {
  /* PHC base64 is unpadded, which is what both `hash-wasm` and the native
   * library emit; `parsePhc` reads either back. */
  const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64").replace(/=+$/, "");
  const { memoryCost, timeCost, parallelism } = ARGON_OPTIONS;
  return `$argon2id$v=${PHC_VERSION}$m=${memoryCost},t=${timeCost},p=${parallelism}$${b64(salt)}$${b64(digest)}`;
}

/** Runs one argon2id derivation at the module's cost profile. */
async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return argon2id({
    password,
    salt,
    iterations: ARGON_OPTIONS.timeCost,
    parallelism: ARGON_OPTIONS.parallelism,
    memorySize: ARGON_OPTIONS.memoryCost,
    hashLength: HASH_BYTES,
    outputType: "binary",
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  return encodePhc(salt, await derive(password, salt));
}

/**
 * Hashes a six-digit exam OTP, a recovery code or an access-link secret.
 *
 * Shares the password cost profile so one argon2 config governs the whole app.
 * The value is short-lived and low-entropy, so the only thing standing between
 * a database leak and a valid code is the 19 MiB cost plus the attempt cap
 * enforced by the calling route.
 */
export async function hashSecret(secret: string): Promise<string> {
  return hashPassword(secret);
}

/**
 * Returns false rather than throwing: a malformed stored hash must not be able
 * to turn into a 500 on the login route.
 */
export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  const parsed = parsePhc(passwordHash);

  if (!parsed) {
    /* Unrecognised value: spend the same work as a real check so callers that
     * use this as a timing decoy keep decoying, then fail. */
    try {
      await derive(password, DUMMY_SALT);
    } catch {
      /* A failure to derive is still a failed verification. */
    }
    return false;
  }

  try {
    const computed = await argon2id({
      password,
      salt: parsed.salt,
      iterations: parsed.timeCost,
      parallelism: parsed.parallelism,
      memorySize: parsed.memoryCost,
      hashLength: parsed.digest.length,
      outputType: "binary",
    });
    return timingSafeEqual(computed, parsed.digest);
  } catch {
    return false;
  }
}

/** Constant-time string compare for secrets that are not argon2 hashes. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const { timingSafeEqual, createHash } = await import("node:crypto");

  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();

  return timingSafeEqual(ha, hb);
}
