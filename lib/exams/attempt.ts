import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { hashExamToken } from "@/lib/exams/token";
import { parseManifest, type ExamManifest } from "@/lib/exams/manifest";

/**
 * One place that knows how to find an attempt by its emailed token, so no route
 * can accidentally look it up by plaintext or by id.
 */

/**
 * Derived from the Prisma query rather than hand-written, so adding a column to
 * ExamAttempt cannot leave this type quietly out of date.
 */
export type LoadedAttempt = NonNullable<
  Awaited<ReturnType<typeof findByTokenHash>>
>;

function findByTokenHash(tokenHash: string) {
  return prisma.examAttempt.findUnique({
    where: { tokenHash },
    include: {
      trainee: { select: { id: true, fullName: true, email: true, traineeNo: true } },
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          passMarkPct: true,
          maxAttempts: true,
          examDurationMin: true,
          validityMonths: true,
          topics: true,
          durationValue: true,
          durationUnit: true,
          trainerId: true,
        },
      },
    },
  });
}

export async function loadAttemptByToken(token: string): Promise<LoadedAttempt | null> {
  if (!token || token.length > 128) return null;

  /* Bounded so a pathological token cannot be used to hammer the index. */
  return findByTokenHash(hashExamToken(token));
}

/** Best-effort client identity for the integrity log. Proxies are not trusted. */
export async function requestIp(): Promise<string | null> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || store.get("x-real-ip") || null;
  return ip?.slice(0, 64) ?? null;
}

export async function requestUserAgent(): Promise<string | null> {
  const store = await headers();
  return store.get("user-agent")?.slice(0, 500) ?? null;
}

export function manifestOf(attempt: { manifest: string }): ExamManifest | null {
  return parseManifest(attempt.manifest);
}

/**
 * How many seconds past the paper's deadline it is now. Negative while time remains.
 *
 * Unlike {@link secondsRemaining} this is NOT clamped at zero, so "30 seconds late"
 * and "an hour late" can be told apart. The grace period is judged on this.
 */
export function secondsPastDeadline(attempt: {
  startedAt: Date | null;
  durationMin: number;
}): number {
  if (!attempt.startedAt) return -attempt.durationMin * 60;
  const endsAt = attempt.startedAt.getTime() + attempt.durationMin * 60 * 1000;
  return Math.floor((Date.now() - endsAt) / 1000);
}

/** Seconds left on the paper, derived server-side so the clock cannot be moved. */
export function secondsRemaining(attempt: {
  startedAt: Date | null;
  durationMin: number;
}): number {
  if (!attempt.startedAt) return attempt.durationMin * 60;
  const endsAt = attempt.startedAt.getTime() + attempt.durationMin * 60 * 1000;
  return Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
}