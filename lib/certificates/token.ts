/**
 * Verification-token helpers.
 *
 * Split out from `lib/certificates/verify.ts` so the browser can use the parsing
 * helpers without dragging Prisma and the `pg` driver into the client bundle.
 * Nothing here touches the database.
 */

/** A 32-byte token in base64url is exactly 43 characters. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function looksLikeVerificationToken(value: string): boolean {
  return TOKEN_SHAPE.test(value.trim());
}

/**
 * Pulls a bare token out of whatever the user pasted.
 *
 * People paste the whole line off the email — a URL, or a URL trailing a stray
 * period — so a full link is accepted rather than telling them off.
 */
export function extractToken(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/verify\/([A-Za-z0-9_-]+)/);
  return (fromUrl ? fromUrl[1] : trimmed).trim();
}
