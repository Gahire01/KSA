import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { formatDuration, studentNumberStart } from "@/lib/certificates/issue";
import { registerNumberFor } from "@/lib/certificates/student-number";
import { DIRECTOR_NAME, DIRECTOR_TITLE } from "@/lib/certificates/signer";
import { canonicalJson, sha256Hex } from "@/lib/exams/manifest";

export class ManualCertificateError extends Error {}

/** A name-only issuance creates a minimal trainee record, never an exam or login. */
export async function issueManualCertificate(input: {
  traineeName: string; traineeId?: string; courseId: string; issuedOn: string;
}, actor: { id: string; email: string }) {
  for (let retry = 0; retry < 3; retry++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const course = await tx.course.findUnique({ where: { id: input.courseId } });
        if (!course?.isActive) throw new ManualCertificateError("Choose an active course.");
        const existing = input.traineeId
          ? await tx.trainee.findFirst({ where: { OR: [{ id: input.traineeId }, { traineeNo: input.traineeId }] } })
          : null;
        if (input.traineeId && !existing) throw new ManualCertificateError("Trainee ID was not found.");
        if (existing && existing.fullName.trim().toLowerCase() !== input.traineeName.trim().toLowerCase()) {
          throw new ManualCertificateError("The name must match the selected trainee's registered name.");
        }
        const trainee = existing ?? await tx.trainee.create({ data: {
          traineeNo: `MANUAL-${randomUUID()}`, fullName: input.traineeName,
          email: "", phone: "", countryCode: "RW", categoryId: course.categoryId,
          courseId: course.id, status: "COMPLETED",
          notes: "Created for a manually issued certificate; no exam taken.",
        } });
        const highest = await tx.certificate.aggregate({ _max: { studentNumber: true } });
        const trainees = await tx.trainee.findMany({ select: { traineeNo: true } });
        const highestTrainee = trainees.reduce((max, row) => /^\d{1,9}$/.test(row.traineeNo)
          ? Math.max(max, Number(row.traineeNo)) : max, 0);
        const preferred = /^\d{1,9}$/.test(trainee.traineeNo)
          ? Number(trainee.traineeNo) : registerNumberFor(trainee.fullName);
        const taken = preferred && await tx.certificate.findUnique({ where: { studentNumber: preferred }, select: { id: true } });
        const studentNumber = preferred && preferred > 0 && !taken ? preferred
          : Math.max(highest._max.studentNumber ?? 0, highestTrainee, studentNumberStart() - 1) + 1;
        const signature = await tx.signature.findFirst({ where: { isActive: true } });
        const trainer = course.trainerId ? await tx.user.findUnique({ where: { id: course.trainerId } }) : null;
        const issuedAt = new Date(`${input.issuedOn}T00:00:00.000Z`);
        const verificationToken = randomBytes(32).toString("base64url");
        const durationSnapshot = formatDuration(course.durationValue, course.durationUnit);
        const trainerNameSnapshot = trainer?.name?.trim() || `Kigali Safety Academy ${DIRECTOR_TITLE}`;
        const trainerTitleSnapshot = trainer?.role === "TRAINER" ? "Trainer" : DIRECTOR_TITLE;
        const certificate = await tx.certificate.create({ data: {
          traineeId: trainee.id, courseId: course.id, studentNumber, verificationToken,
          topicsSnapshot: course.topics, durationSnapshot, trainerNameSnapshot, trainerTitleSnapshot,
          signatureUrlSnapshot: signature?.imageUrl ?? null,
          signerNameSnapshot: signature?.signerName ?? DIRECTOR_NAME,
          signerTitleSnapshot: signature?.signerTitle ?? DIRECTOR_TITLE,
          issuedAt, expiresAt: null,
          contentHash: sha256Hex(canonicalJson({ studentNumber, traineeName: trainee.fullName,
            courseName: course.name, topics: course.topics, duration: durationSnapshot,
            trainerName: trainerNameSnapshot, trainerTitle: trainerTitleSnapshot,
            issuedAt: issuedAt.toISOString(), expiresAt: null, verificationToken })),
        }, select: { id: true, studentNumber: true } });
        await tx.auditLog.create({ data: {
          actorId: actor.id, actorEmail: actor.email, action: "certificate.manual_issue",
          entityType: "Certificate", entityId: certificate.id,
          meta: JSON.stringify({ traineeId: trainee.id, courseId: course.id, issuedOn: input.issuedOn }),
        } });
        return certificate;
      }, { isolationLevel: "Serializable", timeout: 15000 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (retry < 2 && (code === "P2002" || code === "P2034")) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a certificate number.");
}
