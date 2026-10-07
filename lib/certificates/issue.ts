import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { preferredStudentNumber } from "@/lib/certificates/student-number";
import { getActiveSignature } from "@/lib/signature/active";
import { canonicalJson, sha256Hex } from "@/lib/exams/manifest";
import { certificateEmail } from "@/lib/email/templates";
import { appUrl, sendEmail } from "@/lib/email/send";
import { REGISTER_NEXT_STUDENT_NUMBER } from "../../scripts/student-list/register-numbers";

/**
 * Certificate issuance.
 *
 * Two things here are deliberate:
 *
 * 1. Every field the certificate prints is **snapshotted**. A course renamed next
 *    month must not rewrite a certificate already in a trainee's hand, so topics,
 *    duration and the trainer's name and title are frozen onto the row at issue
 *    time and the PDF reads only from those.
 *
 * 2. The student number is allocated from `MAX(studentNumber)` under a retry.
 *    There is no Postgres sequence to lean on (the academy expects to supply its
 *    own starting number), so the unique index is what makes a collision
 *    impossible — a loser retries with +1 rather than silently taking a
 *    duplicate.
 */

import { DIRECTOR_NAME, DIRECTOR_TITLE } from "@/lib/certificates/signer";

export { DIRECTOR_NAME, DIRECTOR_TITLE };

/**
 * First student number when the certificate table is empty.
 *
 * Certificate numbers continue past the academy's register (KIGALI SAFETY
 * ACADEMY STUDENTS LIST.docx, max slot 456), so the default start is 457.
 * The owner can still force a start with SEED_STUDENT_START in the
 * environment without a code change.
 */
export function studentNumberStart(): number {
  const raw = process.env.SEED_STUDENT_START ?? String(REGISTER_NEXT_STUDENT_NUMBER);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : REGISTER_NEXT_STUDENT_NUMBER;
}

/**
 * Highest register student number currently held by a trainee (traineeNo is
 * the plain register number), or REGISTER_MAX_STUDENT_NUMBER when nothing
 * has been seeded yet.
 *
 * Trainee numbers that are not plain digits (e.g. "KSA-0001") are ignored so
 * they cannot drag the certificate sequence backwards.
 */
async function highestRegisterNumber(): Promise<number> {
  const rows = await prisma.trainee.findMany({
    select: { traineeNo: true },
  });

  let max = REGISTER_NEXT_STUDENT_NUMBER - 1;
  for (const row of rows) {
    const n = /^\d+$/.test(row.traineeNo) ? Number.parseInt(row.traineeNo, 10) : Number.NaN;
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function formatDuration(value: number, unit: string): string {
  const plural = value === 1 ? "" : "s";
  switch (unit) {
    case "DAY":
      return `${value} Day${plural}`;
    case "WEEK":
      return `${value} Week${plural}`;
    case "MONTH":
      return `${value} Month${plural}`;
    default:
      return `${value}`;
  }
}

export interface IssueInput {
  traineeId: string;
  courseId: string;
  attemptId?: string | null;
}

export interface IssueResult {
  certificate: {
    id: string;
    studentNumber: number;
    verificationToken: string;
    contentHash: string;
    issuedAt: Date;
    expiresAt: Date | null;
    traineeName: string;
    courseName: string;
  };
  emailed: boolean;
}

export async function issueCertificate(input: IssueInput): Promise<IssueResult | null> {
  const [trainee, course] = await Promise.all([
    prisma.trainee.findUnique({ where: { id: input.traineeId } }),
    prisma.course.findUnique({ where: { id: input.courseId } }),
  ]);

  if (!trainee || !course) return null;

  /* One certificate per attempt. */
  if (input.attemptId) {
    const existing = await prisma.certificate.findUnique({
      where: { attemptId: input.attemptId },
      include: { trainee: true, course: true },
    });
    if (existing) {
      return {
        certificate: {
          id: existing.id,
          studentNumber: existing.studentNumber,
          verificationToken: existing.verificationToken,
          contentHash: existing.contentHash,
          issuedAt: existing.issuedAt,
          expiresAt: existing.expiresAt,
          traineeName: existing.trainee.fullName,
          courseName: existing.course.name,
        },
        emailed: true,
      };
    }
  }

  const trainer = course.trainerId
    ? await prisma.user.findUnique({
        where: { id: course.trainerId },
        select: { name: true, role: true },
      })
    : null;

  const trainerNameSnapshot =
    trainer?.name?.trim() || `Kigali Safety Academy ${DIRECTOR_TITLE}`;
  const trainerTitleSnapshot =
    trainer?.role === "TRAINER" ? "Trainer" : DIRECTOR_TITLE;

  /* Frozen onto the row: a signature locked next year must not change this
   * certificate. Name and title are ALWAYS written (Director defaults when none
   * is active): a null signerNameSnapshot is what marks a legacy certificate
   * issued before this system, so a new one must never leave it null. With no
   * active signature the URL stays null and the PDF prints a plain line. */
  const signature = await getActiveSignature();

  const issuedAt = new Date();
  const durationSnapshot = formatDuration(course.durationValue, course.durationUnit);

  /* Certificates never expire: the academy certifies competence, not a validity
   * window. The column stays for legacy and audit, but issuance always writes
   * null so no certificate ever reads as expiring or expired. */
  const expiresAt = null;

  /* The canonical snapshot that gets hashed. Keys are sorted by canonicalJson,
   * so this digest is reproducible from these fields alone. */
  const snapshot = {
    studentNumber: 0,
    traineeName: trainee.fullName,
    courseName: course.name,
    topics: course.topics,
    duration: durationSnapshot,
    trainerName: trainerNameSnapshot,
    trainerTitle: trainerTitleSnapshot,
    issuedAt: issuedAt.toISOString(),
    expiresAt: null,
  };

  /* Allocation: MAX+1, defaulting to just past the register on an empty
   * table (SEED_STUDENT_START overrides that fallback). Two certificates
   * issued at the same instant can pick the same number; the unique index
   * rejects the loser, which retries once with +1. */
  let allocated: {
    id: string;
    studentNumber: number;
    verificationToken: string;
    contentHash: string;
    issuedAt: Date;
    expiresAt: Date | null;
  } | null = null;

  const preferred = await preferredStudentNumber({
    traineeNo: trainee.traineeNo,
    fullName: trainee.fullName,
  });

  for (let attempt = 0; attempt < 3 && !allocated; attempt += 1) {
    const highest = await prisma.certificate.findFirst({
      orderBy: { studentNumber: "desc" },
      select: { studentNumber: true },
    });

    const first = highest
      ? 0
      : Math.max(studentNumberStart(), await highestRegisterNumber());
    /* First try the number the student already holds (their own trainee number or
     * their register entry). If that is taken or collides, fall back to the next
     * free number after the highest issued. */
    const fallback = (highest?.studentNumber ?? first) + 1 + attempt;
    const next = attempt === 0 && preferred !== null ? preferred : fallback;

    const verificationToken = randomBytes(32).toString("base64url");

    /* The printed number is part of the hashed snapshot, so the hash covers the
     * number the trainee actually holds. */
    const contentHash = sha256Hex(
      canonicalJson({ ...snapshot, studentNumber: next, verificationToken }),
    );

    try {
      allocated = await prisma.certificate.create({
        data: {
          traineeId: trainee.id,
          courseId: course.id,
          attemptId: input.attemptId ?? null,
          studentNumber: next,
          verificationToken,
          contentHash,
          topicsSnapshot: course.topics,
          durationSnapshot,
          trainerNameSnapshot,
          trainerTitleSnapshot,
          signatureUrlSnapshot: signature?.imageUrl ?? null,
          signerNameSnapshot: signature?.signerName ?? DIRECTOR_NAME,
          signerTitleSnapshot: signature?.signerTitle ?? DIRECTOR_TITLE,
          issuedAt,
          expiresAt,
        },
        select: {
          id: true,
          studentNumber: true,
          verificationToken: true,
          contentHash: true,
          issuedAt: true,
          expiresAt: true,
        },
      });
    } catch (error) {
      const isNumberClash =
        typeof error === "object" &&
        error !== null &&
        (error as { code?: string }).code === "P2002";

      /* A unique violation on the verification token is astronomically unlikely
       * and not something a retry fixes. */
      if (!isNumberClash) {
        console.error("[certificates] issuance failed", error);
        return null;
      }
    }
  }

  if (!allocated) {
    console.error("[certificates] could not allocate a student number after 3 tries");
    return null;
  }

  const verifyUrl = appUrl(`/verify/${allocated.verificationToken}`);

  const email = certificateEmail({
    traineeName: trainee.fullName,
    courseName: course.name,
    studentNumber: allocated.studentNumber,
    verifyUrl,
    issuedAt: allocated.issuedAt,
  });

  const delivered = await sendEmail({
    to: trainee.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  return {
    certificate: {
      ...allocated,
      traineeName: trainee.fullName,
      courseName: course.name,
    },
    emailed: delivered.ok,
  };
}