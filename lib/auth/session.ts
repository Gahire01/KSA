import { createHmac, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import {
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from "@/lib/auth/cookies";

export const SESSION_DAYS = 7;

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
}): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      id: deriveSessionId(token),
      userId: params.userId,
      mfaPassed: params.mfaPassed ?? false,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      ip: params.ip ?? null,
      userAgent: params.userAgent?.slice(0, 500) ?? null,
    },
  });

  await setSessionCookie(token);
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
