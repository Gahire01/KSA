import { createHmac, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { deviceState } from "@/lib/auth/devices";
import {
  SESSION_SHORT_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from "@/lib/auth/cookies";

/** The longest a session can live: 30 days with "Remember me" ticked. */
export const SESSION_DAYS = 30;
/** The shortest: 12 hours when it is not. */
export const SESSION_SHORT_HOURS = 12;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }

  return secret;
}

/**
 * The cookie holds a random token; only an HMAC of it keyed by SESSION_SECRET is
 * stored. A leaked database therefore cannot be turned into usable sessions, and
 * the stored id is never a valid cookie value on its own.
 */
function deriveSessionId(token: string): string {
  return createHmac("sha256", sessionSecret()).update(token).digest("base64url");
}

export async function createSession(params: {
  userId: string;
  mfaPassed?: boolean;
  ip?: string | null;
  userAgent?: string | null;
  /**
   * The access link this session was minted from, when there was one.
   *
   * Recorded so that revoking the link can cascade: a withdrawn invitation must also
   * end the session it created, or the recipient stays signed in after the owner
   * revoked their access.
   */
  accessLinkId?: string | null;
  /** The referral code this session was minted from, when there was one. */
  referralCodeId?: string | null;
  /**
   * "Remember me for 30 days". Defaults to true; false yields a 12-hour
   * session instead. The cookie's max-age and the row's expiry are set from
   * the same number so the two cannot drift apart.
   */
  remember?: boolean;
  /**
   * A hard ceiling on the session's life. Link and referral sessions pass the
   * link's own expiry here, so the session can never outlast the access that
   * granted it.
   */
  maxExpiresAt?: Date;
}): Promise<void> {
  const requestedTtl = params.remember === false ? SESSION_SHORT_TTL_SECONDS : SESSION_TTL_SECONDS;
  const ttlSeconds = params.maxExpiresAt
    ? Math.max(60, Math.min(requestedTtl, Math.floor((params.maxExpiresAt.getTime() - Date.now()) / 1000)))
    : requestedTtl;
  const token = randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      id: deriveSessionId(token),
      userId: params.userId,
      mfaPassed: params.mfaPassed ?? false,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      ip: params.ip ?? null,
      userAgent: params.userAgent?.slice(0, 500) ?? null,
      accessLinkId: params.accessLinkId ?? null,
      referralCodeId: params.referralCodeId ?? null,
      lastSeenAt: new Date(),
    },
  });

  await setSessionCookie(token, ttlSeconds);
}

/**
 * Resolves the session behind the current request cookie.
 *
 * Returns null for missing, unknown, expired or deactivated-user sessions and
 * cleans up the cookie in each of those cases.
 */
export async function getSession() {
  const token = await readSessionCookie();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: deriveSessionId(token) },
    include: { user: true },
  });

  if (!session) {
    await clearSessionCookie();
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    await clearSessionCookie();
    return null;
  }

  if (!session.user.isActive) {
    await clearSessionCookie();
    return null;
  }

  /* A session minted from an access link lives and dies with that link: once the
   * owner revokes it, or it passes its expiry, every session it produced ends on
   * the next request. */
  if (session.accessLinkId) {
    const link = await prisma.accessLink.findUnique({
      where: { id: session.accessLinkId },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!link || link.revokedAt || link.expiresAt <= new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      await clearSessionCookie();
      return null;
    }
  }

  /* The same for a session minted from a referral code. */
  if (session.referralCodeId) {
    const code = await prisma.referralCode.findUnique({
      where: { id: session.referralCodeId },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!code || code.revokedAt || code.expiresAt <= new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      await clearSessionCookie();
      return null;
    }
  }

  /* A session only travels with the device that was admitted for it. */
  const device = await deviceState(session.userId, {
    accessLinkId: session.accessLinkId,
    referralCodeId: session.referralCodeId,
  });

  if (device === "revoked") {
    /* The device itself was withdrawn, so the session it created is finished. */
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    await clearSessionCookie();
    return null;
  }

  if (device === "unknown") {
    /* Session cookie without its device identity — refuse this request but leave
     * the row alone, so a leaked session cookie cannot be used to sign the real
     * device out. */
    return null;
  }

  /* "Last seen" for the sessions list. Throttled to one write per five minutes
   * so a busy browser does not turn every navigation into an UPDATE. */
  const lastSeen = session.lastSeenAt ?? session.createdAt;
  if (Date.now() - lastSeen.getTime() > 5 * 60_000) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return session;
}

export async function destroySession(): Promise<void> {
  const token = await readSessionCookie();

  if (token) {
    await prisma.session
      .deleteMany({ where: { id: deriveSessionId(token) } })
      .catch(() => {});
  }

  await clearSessionCookie();
}

/** Called once the second factor is satisfied for this session. */
export async function markSessionMfaPassed(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { mfaPassed: true },
  });
}

export async function countActiveSessions(userId: string): Promise<number> {
  return prisma.session.count({
    where: { userId, expiresAt: { gt: new Date() } },
  });
}

/**
 * Every live session for one account, newest activity first.
 *
 * Scoped by `userId` alone: a caller can only ever see their own rows, and the
 * id returned is the stored HMAC — the cookie token itself is never recoverable
 * from it, so listing sessions cannot leak a usable credential.
 */
export async function listSessions(userId: string) {
  return prisma.session.findMany({
    /* The account's own sign-ins. A trainer's link and code holders share this user id but
     * are not "my sessions": they must not be listed, signed out, or ended from here. */
    where: { userId, accessLinkId: null, referralCodeId: null, expiresAt: { gt: new Date() } },
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      ip: true,
      userAgent: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
  });
}

/** Signs one of the caller's own sessions out. Returns false when it was not theirs. */
export async function revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
  const result = await prisma.session.deleteMany({
    where: { id: sessionId, userId, accessLinkId: null, referralCodeId: null },
  });
  return result.count > 0;
}

/**
 * Signs every other session out, keeping the one in `keepSessionId`.
 *
 * Deleting rows rather than revoking devices on purpose: this is "sign out
 * elsewhere", not "forget my browsers", so the same devices stay remembered and
 * can sign back in with a code.
 */
export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { userId, accessLinkId: null, referralCodeId: null, id: { not: keepSessionId } },
  });
  return result.count;
}
