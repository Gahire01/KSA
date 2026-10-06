import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

/**
 * Device identity and the concurrent-device cap.
 *
 * ## Why a cookie and not the user-agent
 *
 * A user-agent is not a device. It changes on every browser update, several browsers
 * and OSes share one string, and the same phone switches between "Mobile Safari" and
 * a desktop UA in landscape on some setups. Keying the cap on it would either evict
 * a user who merely updated, or count six phones sharing one UA as one device.
 *
 * So the browser is issued a random id cookie, and `deviceHash` is an HMAC of that
 * id. Two consequences that are the point of it:
 *
 *  - It is stable across UA changes, so a legitimate user is not silently evicted.
 *  - It is a one-way keyed digest, so `deviceHash` in the database cannot be turned
 *    back into a cookie value and replayed to impersonate a device. The same reason
 *    the session table stores an HMAC rather than the raw token.
 *
 * ## The cap
 *
 * Five active devices per user, counted as non-revoked `DeviceSession` rows. When a
 * sixth appears the *least recently seen* device is revoked rather than the new one:
 * refusing the new sign-in would lock a user out of their own account for owning an
 * old phone, while evicting the stale device keeps them in and still bounds the count.
 *
 * The cap is per *user*, and an access-link session counts against the same limit —
 * an invite link must not be a way to sidestep it.
 */

export const MAX_DEVICES = 5;

const DEV_COOKIE = "ksa_device";
const PROD_COOKIE = "__Host-ksa_device";

/** 180 days: long enough to survive a holiday, short enough to eventually re-key. */
const DEVICE_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 180;

function deviceCookieName(): string {
  return process.env.NODE_ENV === "production" ? PROD_COOKIE : DEV_COOKIE;
}

function deviceSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }

  return secret;
}

export function hashDeviceId(deviceId: string): string {
  return createHmac("sha256", deviceSecret()).update(`device:${deviceId}`).digest("base64url");
}

/**
 * Reads the device id cookie, minting one if absent.
 *
 * Returns the raw id for this request only; callers persist `hashDeviceId(id)`, never
 * the id itself.
 */
export async function resolveDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(deviceCookieName())?.value;

  if (existing && /^[A-Za-z0-9_-]{32,64}$/.test(existing)) {
    return existing;
  }

  const minted = randomBytes(32).toString("base64url");

  store.set(deviceCookieName(), minted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_TTL_SECONDS,
  });

  return minted;
}

export interface RecordDeviceInput {
  userId: string;
  accessLinkId?: string | null;
  referralCodeId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}

export interface RecordDeviceResult {
  deviceId: string;
  activeCount: number;
  /** Set when this sign-in pushed the account over the cap. */
  evictedDeviceId: string | null;
}

/**
 * Notes that this device just signed in, and enforces {@link MAX_DEVICES}.
 *
 * Idempotent per device: an existing row is touched rather than duplicated, so
 * signing in ten times from the same browser is still one device.
 */
export async function recordDevice(input: RecordDeviceInput): Promise<RecordDeviceResult> {
  const deviceId = await resolveDeviceId();
  const deviceHash = hashDeviceId(deviceId);

  const existing = await prisma.deviceSession.findFirst({
    where: { userId: input.userId, deviceHash },
    select: { id: true, revokedAt: true },
  });

  if (existing && !existing.revokedAt) {
    await prisma.deviceSession.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
    const activeCount = await activeDeviceCount(input.userId);
    return { deviceId, activeCount, evictedDeviceId: null };
  }

  if (existing?.revokedAt) {
    /* A revoked device that signs in again is being re-admitted deliberately, so it
     * is cleared rather than treated as a brand new device. */
    await prisma.deviceSession.update({
      where: { id: existing.id },
      data: {
        revokedAt: null,
        lastSeenAt: new Date(),
        accessLinkId: input.accessLinkId ?? null,
        referralCodeId: input.referralCodeId ?? null,
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    });
    const activeCount = await activeDeviceCount(input.userId);
    return { deviceId, activeCount, evictedDeviceId: null };
  }

  await prisma.deviceSession.create({
    data: {
      userId: input.userId,
      accessLinkId: input.accessLinkId ?? null,
      referralCodeId: input.referralCodeId ?? null,
      deviceHash,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      ipAddress: input.ip ?? null,
    },
  });

  return { deviceId, ...(await enforceDeviceCap(input.userId)) };
}

/**
 * Reads the device id cookie without minting one.
 *
 * Used on the session-validation path, where writing a cookie would be a side
 * effect on a request that is about to be rejected anyway.
 */
export async function peekDeviceId(): Promise<string | null> {
  const store = await cookies();
  const existing = store.get(deviceCookieName())?.value;
  return existing && /^[A-Za-z0-9_-]{32,64}$/.test(existing) ? existing : null;
}

/**
 * How the device behind this request relates to the account on the session.
 *
 *  - `active`   — a live, non-revoked row for this user: proceed.
 *  - `revoked`  — the device was admitted once and has since been revoked (owner
 *                 action, sign-out-everywhere, or sixth-device eviction). The
 *                 session that device created must now end.
 *  - `unknown`  — no device cookie, or no row for this user. This is a session
 *                 cookie arriving without the device identity it was minted with,
 *                 which is what a copied cookie looks like. Reject it — but do not
 *                 delete the row, because the caller could equally be an attacker
 *                 holding one half of the credential, and destroying the real
 *                 session would hand them a denial of service against the owner.
 */
export type DeviceState = "active" | "revoked" | "unknown";

export async function deviceState(userId: string): Promise<DeviceState> {
  const deviceId = await peekDeviceId();
  if (!deviceId) return "unknown";

  const row = await prisma.deviceSession.findFirst({
    where: { userId, deviceHash: hashDeviceId(deviceId) },
    select: { revokedAt: true },
  });

  if (!row) return "unknown";
  return row.revokedAt ? "revoked" : "active";
}

export async function activeDeviceCount(userId: string): Promise<number> {
  return prisma.deviceSession.count({ where: { userId, revokedAt: null } });
}

/**
 * Evicts least-recently-seen devices until the account is back under the cap.
 *
 * Split out from {@link recordDevice} so it can also be called on its own, e.g. after
 * an owner revokes one manually.
 */
export async function enforceDeviceCap(
  userId: string,
): Promise<{ activeCount: number; evictedDeviceId: string | null }> {
  /* The owner is never capped. They must be able to sign in from any PC, phone
   * or browser they own without an old device silently being evicted — only
   * access-link accounts (team members) are bounded by MAX_DEVICES. */
  const owner = await prisma.user.findFirst({
    where: { id: userId, role: "OWNER" },
    select: { id: true },
  });
  if (owner) {
    return { activeCount: await activeDeviceCount(userId), evictedDeviceId: null };
  }

  let activeCount = await activeDeviceCount(userId);

  if (activeCount <= MAX_DEVICES) {
    return { activeCount, evictedDeviceId: null };
  }

  /* Order by lastSeenAt ascending so the oldest is first, then revoke exactly as
   * many as the overflow rather than clearing the whole list. */
  const surplus = activeCount - MAX_DEVICES;
  const evict = await prisma.deviceSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "asc" },
    take: surplus,
    select: { id: true },
  });

  if (evict.length > 0) {
    await prisma.deviceSession.updateMany({
      where: { id: { in: evict.map((d) => d.id) } },
      data: { revokedAt: new Date() },
    });
  }

  activeCount = await activeDeviceCount(userId);
  return { activeCount, evictedDeviceId: evict[0]?.id ?? null };
}

/** Revokes every device, e.g. on sign-out-everywhere. Does not touch the current one. */
export async function revokeAllDevices(userId: string, exceptDeviceId?: string): Promise<number> {
  const current = exceptDeviceId ? hashDeviceId(exceptDeviceId) : null;
  const rows = await prisma.deviceSession.findMany({
    where: { userId, revokedAt: null, ...(current ? { deviceHash: { not: current } } : {}) },
    select: { id: true },
  });
  if (rows.length === 0) return 0;
  await prisma.deviceSession.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { revokedAt: new Date() },
  });
  return rows.length;
}
