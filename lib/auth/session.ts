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
  accessLinkId?: string | null;
  referralCodeId?: string | null;
  remember?: boolean;
  maxExpiresAt?: Date;
}): Promise<void> {
  const requestedTtl =
    params.remember === false ? SESSION_SHORT_TTL_SECONDS : SESSION_TTL_SECONDS;
  const ttlSeconds = params.maxExpiresAt
    ? Math.max(
        60,
        Math.min(
          requestedTtl,
          Math.floor((params.maxExpiresAt.getTime() - Date.now()) / 1000),
        ),
      )
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
 * READ-ONLY with respect to cookies. Next.js 15 forbids cookie writes from
 * Server Components, and this function is called from `app/(app)/layout.tsx`.
 * Stale cookies are cleaned up by `middleware.ts` on the next request instead
 * (see `withStaleCookieCleanup` there).
 *
 * The DB row IS deleted when the session is invalid, so even if the browser
 * keeps presenting the old token, it can never resolve again.
 */
export async function getSession() {
  const token = await readSessionCookie();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: deriveSessionId(token) },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (!session.user.isActive) {
    return null;
  }

  /* A session minted from an access link lives and dies with that link. */
  if (session.accessLinkId) {
    const link = await prisma.accessLink.findUnique({
      where: { id: session.accessLinkId },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!link || link.revokedAt || link.expiresAt <= new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
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
      return null;
    }
  }

  /* A session only travels with the device that was admitted for it. */
  const device = await deviceState(session.userId, {
    accessLinkId: session.accessLinkId,
    referralCodeId: session.referralCodeId,
  });

  if (device === "revoked") {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (device === "unknown") {
    /* Session cookie without its device identity — refuse this request but
     * leave the row alone, so a leaked cookie cannot sign the real device out. */
    return null;
  }

  /* "Last seen" for the sessions list, throttled to one write per 5 minutes. */
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

  /* Safe here — this runs from the logout Route Handler. */
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

export async function listSessions(userId: string) {
  return prisma.session.findMany({
    where: {
      userId,
      accessLinkId: null,
      referralCodeId: null,
      expiresAt: { gt: new Date() },
    },
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

export async function revokeSessionById(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const result = await prisma.session.deleteMany({
    where: {
      id: sessionId,
      userId,
      accessLinkId: null,
      referralCodeId: null,
    },
  });
  return result.count > 0;
}

export async function revokeOtherSessions(
  userId: string,
  keepSessionId: string,
): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      accessLinkId: null,
      referralCodeId: null,
      id: { not: keepSessionId },
    },
  });
  return result.count;
}