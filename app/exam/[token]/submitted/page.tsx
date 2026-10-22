import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashExamToken } from "@/lib/exams/token";
import { readExamSession } from "@/lib/exams/session-cookie";
import { ExamSubmitted } from "@/components/exam/ExamRunner";

export const dynamic = "force-dynamic";

export default async function SubmittedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) notFound();
  const attempt = await prisma.examAttempt.findUnique({
    where: { tokenHash: hashExamToken(token) },
    include: { course: { select: { name: true, passMarkPct: true, maxAttempts: true } },
      certificate: { select: { id: true, studentNumber: true, verificationToken: true, revokedAt: true } } },
  });
  if (!attempt || attempt.status !== "PASSED" || !await readExamSession(token, attempt.id)) notFound();
  return <ExamSubmitted examToken={token} courseName={attempt.course.name}
    submittedAt={(attempt.submittedAt ?? attempt.createdAt).toISOString()}
    result={{ status: attempt.status, passed: true, scorePct: attempt.scorePct,
      correctCount: attempt.correctCount, totalCount: attempt.totalCount,
      passMarkPct: attempt.course.passMarkPct, attemptNumber: attempt.attemptNumber,
      maxAttempts: attempt.course.maxAttempts,
      attemptsRemaining: Math.max(0, attempt.course.maxAttempts - attempt.attemptNumber), exhausted: false,
      certificate: attempt.certificate && !attempt.certificate.revokedAt ? {
        id: attempt.certificate.id, studentNumber: attempt.certificate.studentNumber,
        verificationToken: attempt.certificate.verificationToken,
      } : null,
    }} />;
}
