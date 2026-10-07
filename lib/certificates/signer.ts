/**
 * The signer a certificate carries when none was snapshotted: the Director.
 * Kept in its own module (no database, no email) so the public verify projection
 * and the client can use it without pulling in the issuing code.
 */
export const DIRECTOR_NAME = "Fredson Niyoniringiye";
export const DIRECTOR_TITLE = "Director";
