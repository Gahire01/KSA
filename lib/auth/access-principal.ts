import { randomBytes } from "node:crypto";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/types";

/**
 * Who a link or referral session runs as.
 *
 * Team members have no login. A link is the credential, so a session minted from
 * one needs a `User` row to hang off (the rest of the app is keyed on user id),
 * and this picks it:
 *
 *  - A TRAINER link acts as the trainer it names. Course ownership checks compare
 *    `course.trainerId` with the session user id, so being that trainer is what
 *    scopes the session to exactly their courses. The trainer must exist, be a
 *    TRAINER and be active, or the link is dead.
 *  - An ADMIN link gets one service account per link, created on first use. Its
 *    password is random and thrown away and its address cannot receive mail, so it
 *    can never be used to sign in any other way than through the link. One account
 *    per link also means the audit log can say which link did what.
 */
export async function resolveAccessPrincipal(input: {
  kind: "link" | "referral";
  id: string;
  role: Role;
  trainerId: string | null;
  label: string | null;
}): Promise<{ ok: true; userId: string } | { ok: false }> {
  if (input.role === "TRAINER") {
    if (!input.trainerId) return { ok: false };

    const trainer = await prisma.user.findUnique({
      where: { id: input.trainerId },
      select: { id: true, role: true, isActive: true },
    });
    if (!trainer || trainer.role !== "TRAINER" || !trainer.isActive) return { ok: false };
    return { ok: true, userId: trainer.id };
  }

  const email = `access-${input.kind}-${input.id}@access.invalid`;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });
  if (existing) return existing.isActive ? { ok: true, userId: existing.id } : { ok: false };

  try {
    const created = await prisma.user.create({
      data: {
        email,
        name: input.label?.trim() || "Admin (link access)",
        passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
        role: input.role,
        totpEnabled: false,
      },
      select: { id: true },
    });
    return { ok: true, userId: created.id };
  } catch (error) {
    /* Two devices redeeming the same link at once: the loser reads the winner's row. */
    if ((error as { code?: string } | null)?.code === "P2002") {
      const raced = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (raced) return { ok: true, userId: raced.id };
    }
    throw error;
  }
}
