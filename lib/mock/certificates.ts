import { subDays, subMonths } from "date-fns";

import { generateCertNo, generateContentHash, generateToken } from "@/lib/utils/ids";
import type { Certificate } from "@/lib/types";
import { MOCK_NOW, courseById } from "./courses";
import { attempts } from "./attempts";
import { examByCourseId } from "./exams";
import { traineeById, trainees } from "./trainees";
import { trainerById } from "./trainers";

const DURATION_LABELS: Record<string, string> = {
  crs_fire: "3 days · 21 contact hours",
  crs_maint: "5 days · 37 contact hours",
  crs_first: "2 days · 14 contact hours",
  crs_site: "4 weeks · 30 contact hours",
  crs_elec: "5 days · 37 contact hours",
  crs_height: "2 days · 15 contact hours",
  crs_chem: "1 week · 6 contact hours",
  crs_drive: "3 days · 21 contact hours",
};

interface CertPlan {
  attemptId: string | null;
  traineeId: string;
  courseId: string;
  issuedOffsetDays: number;
  validityMonths: number | null;
  status: "VALID" | "EXPIRING" | "EXPIRED" | "REVOKED";
  revokeReason?: string;
}

function plans(): CertPlan[] {
  const out: CertPlan[] = [];
  const passed = attempts.filter((a) => a.status === "PASSED");
  const usedTrainees = new Set<string>();

  passed.forEach((a, i) => {
    usedTrainees.add(a.traineeId);
    out.push({
      attemptId: a.id,
      traineeId: a.traineeId,
      courseId: a.courseId,
      issuedOffsetDays: 3 + i * 4,
      validityMonths: null,
      status: "VALID",
    });
  });

  const completed = trainees
    .filter((t) => t.status === "COMPLETED" && !usedTrainees.has(t.id))
    .slice(0, 9);

  completed.forEach((t, i) => {
    out.push({
      attemptId: null,
      traineeId: t.id,
      courseId: t.courseId,
      issuedOffsetDays: 8 + i * 6,
      validityMonths: null,
      status: "VALID",
    });
  });

  /* One revoked, per the brief. Certificates never expire, so the rest stay valid. */
  const revokeIdx = out.findIndex((p) => p.status === "VALID");
  if (revokeIdx >= 0) {
    out[revokeIdx] = {
      ...out[revokeIdx]!,
      status: "REVOKED",
      revokeReason:
        "Administrative error — certificate was issued against a withdrawn attempt number. Reissued under KSA-CERT-2026-00026.",
    };
  }

  return out;
}

function buildCertificates(): Certificate[] {
  return plans().map((p, i) => {
    const course = courseById.get(p.courseId);
    const attempt = p.attemptId ? attempts.find((a) => a.id === p.attemptId) : null;
    const trainee = traineeById.get(p.traineeId);
    const exam = examByCourseId.get(p.courseId);
    const issuedAt = subDays(MOCK_NOW, p.issuedOffsetDays);
    const certNo = generateCertNo(MOCK_NOW.getFullYear(), i + 1);
    const verificationToken = generateToken("vfy", certNo);

    return {
      id: `crt_${String(i + 1).padStart(3, "0")}`,
      certNo,
      verificationToken,
      traineeId: p.traineeId,
      courseId: p.courseId,
      examId: attempt?.examId ?? exam?.id ?? "",
      attemptId: attempt?.id ?? "",
      trainerId: course?.trainerId ?? trainerById.get("trn_001")?.id ?? "trn_001",
      status: p.status,
      score: attempt?.score ?? trainee?.examScore ?? 82,
      durationLabel: DURATION_LABELS[p.courseId] ?? "3 days · 21 contact hours",
      issuedAt: issuedAt.toISOString(),
      expiresAt: null,
      revokedAt: status === "REVOKED" ? subMonths(MOCK_NOW, 2).toISOString() : null,
      revokeReason: p.revokeReason ?? null,
      contentHash: generateContentHash(`${certNo}|${p.traineeId}|${p.courseId}|${issuedAt.toISOString()}`),
      pdfKey: `certs/${MOCK_NOW.getFullYear()}/${certNo.toLowerCase()}.pdf`,
    };
  });
}

export const certificates: Certificate[] = buildCertificates();

export const certificateById = new Map(certificates.map((c) => [c.id, c]));
export const certificateByToken = new Map(
  certificates.map((c) => [c.verificationToken, c]),
);
