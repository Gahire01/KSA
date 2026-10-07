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

  /* The account's own sign-ins only: rows that belong to a link or a code are theirs
   * to manage, and a password-style sign-in must never revive or collide with one. */
  const existing = await prisma.deviceSession.findFirst({
    where: { userId: input.userId, deviceHash, accessLinkId: null, referralCodeId: null },
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

export async function deviceState(
  userId: string,
  via: { accessLinkId?: string | null; referralCodeId?: string | null } = {},
): Promise<DeviceState> {
  const deviceId = await peekDeviceId();
  if (!deviceId) return "unknown";

  const deviceHash = hashDeviceId(deviceId);

  /* A session is only as good as the device row of the SAME grant that produced it.
   * A link session is checked against that link's row alone, a code session against
   * that code's, and an ordinary sign-in against the account's own rows (neither id).
   * Otherwise a trainer reached through two links, or through a link and their own
   * login, would let one grant's live row keep another grant's removed device alive
   * (or one revocation kill a session it was never entitled to end). */
  const scope = via.accessLinkId
    ? { accessLinkId: via.accessLinkId }
    : via.referralCodeId
      ? { referralCodeId: via.referralCodeId }
      : { accessLinkId: null, referralCodeId: null };

  const live = await prisma.deviceSession.findFirst({
    where: { userId, deviceHash, revokedAt: null, ...scope },
    select: { id: true },
  });
  if (live) return "active";

  const row = await prisma.deviceSession.findFirst({
    where: { userId, deviceHash, ...scope },
    select: { revokedAt: true },
  });

  if (!row) return "unknown";
  return row.revokedAt ? "revoked" : "active";
}

export type AdmitResult =
  | {
      ok: true;
      activeCount: number;
      maxDevices: number;
      /** True when this call registered the device (rather than recognising it). */
      isNew: boolean;
      /** The DeviceSession row, so a caller can back the admission out. */
      deviceRowId: string;
    }
  | { ok: false; reason: "full" | "removed"; activeCount: number; maxDevices: number };

/**
 * Admits a device to a link or referral code, with a hard per-link limit.
 *
 * This is the rule for link-issued access (team members): the sixth device is
 * REFUSED, not swapped in for the oldest. A link is a shared credential, so quietly
 * kicking one holder off to admit another would hand the owner no way to tell who is
 * actually using it. The owner can free a slot by removing a device.
 *
 *  - A device already registered on this link is let straight back in.
 *  - A device the owner removed stays removed: re-redeeming the same link from it
 *    is refused, otherwise "remove device" would do nothing while the link lives.
 *  - Two devices racing for the last slot are settled by recounting after the
 *    insert; the one that finds the count over the limit backs out.
 */
export async function admitDevice(input: {
  userId: string;
  accessLinkId?: string | null;
  referralCodeId?: string | null;
  maxDevices: number;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<AdmitResult> {
  const deviceHash = hashDeviceId(await resolveDeviceId());
  const scope = input.accessLinkId
    ? { accessLinkId: input.accessLinkId }
    : { referralCodeId: input.referralCodeId ?? null };

  const countActive = () => prisma.deviceSession.count({ where: { ...scope, revokedAt: null } });
  const { maxDevices } = input;

  const existing = await prisma.deviceSession.findFirst({
    where: { ...scope, deviceHash },
    select: { id: true, revokedAt: true },
  });

  if (existing) {
    if (existing.revokedAt) {
      return { ok: false, reason: "removed", activeCount: await countActive(), maxDevices };
    }
    await prisma.deviceSession.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    });
    return {
      ok: true,
      activeCount: await countActive(),
      maxDevices,
      isNew: false,
      deviceRowId: existing.id,
    };
  }

  if ((await countActive()) >= maxDevices) {
    return { ok: false, reason: "full", activeCount: maxDevices, maxDevices };
  }

  let created: { id: string };
  try {
    created = await prisma.deviceSession.create({
      data: {
        userId: input.userId,
        accessLinkId: input.accessLinkId ?? null,
        referralCodeId: input.referralCodeId ?? null,
        deviceHash,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
        ipAddress: input.ip ?? null,
      },
      select: { id: true },
    });
  } catch (error) {
    /* The unique (link, device) index: this same browser redeemed twice at once and the
     * other request won. It is one device, already registered, so recognise it. */
    if ((error as { code?: string } | null)?.code === "P2002") {
      const winner = await prisma.deviceSession.findFirst({
        where: { ...scope, deviceHash },
        select: { id: true, revokedAt: true },
      });
      if (winner && !winner.revokedAt) {
        return {
          ok: true,
          activeCount: await countActive(),
          maxDevices,
          isNew: false,
          deviceRowId: winner.id,
        };
      }
    }
    throw error;
  }

  const after = await countActive();
  if (after > maxDevices) {
    await prisma.deviceSession.delete({ where: { id: created.id } }).catch(() => undefined);
    return { ok: false, reason: "full", activeCount: maxDevices, maxDevices };
  }

  return { ok: true, activeCount: after, maxDevices, isNew: true, deviceRowId: created.id };
}

/** The account's own signed-in devices. Link and code devices are counted per link. */
export async function activeDeviceCount(userId: string): Promise<number> {
  return prisma.deviceSession.count({
    where: { userId, revokedAt: null, accessLinkId: null, referralCodeId: null },
  });
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
  /* Own sign-ins only. A device admitted through a link has its own per-link limit and
   * is never swapped out by an unrelated sign-in or by another link's devices. */
  const evict = await prisma.deviceSession.findMany({
    where: { userId, revokedAt: null, accessLinkId: null, referralCodeId: null },
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
    where: {
      userId,
      revokedAt: null,
      accessLinkId: null,
      referralCodeId: null,
      ...(current ? { deviceHash: { not: current } } : {}),
    },
    select: { id: true },
  });
  if (rows.length === 0) return 0;
  await prisma.deviceSession.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { revokedAt: new Date() },
  });
  return rows.length;
}
