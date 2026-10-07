import { guard } from "@/lib/api/guard";
import { apiNotFound, apiOk } from "@/lib/api/response";
import { viaCourse } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";
import { linkState } from "@/lib/exams/link";

/**
 * GET /api/attempts/:id — one sitting as staff see it: who, what, the state of
 * the emailed link, and the integrity flags raised during the exam.
 *
 * Deliberately not selected: tokenHash, otpHash, the manifest, and any answer
 * key. Staff can see how a trainee scored, never how to answer.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await guard("exam.send", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const attempt = await prisma.examAttempt.findFirst({
    where: { id, ...viaCourse(gate.trainerScope) },
    select: {
      id: true,
      status: true,
      attemptNumber: true,
      durationMin: true,
      scorePct: true,
      correctCount: true,
      totalCount: true,
      blurCount: true,
      integrityFlags: true,
      startedAt: true,
      submittedAt: true,
      createdAt: true,
      otpExpiresAt: true,
      linkExpiresAt: true,
      linkUses: true,
      linkMaxUses: true,
      firstOpenedAt: true,
      firstOpenedIp: true,
      firstOpenedUa: true,
      trainee: { select: { id: true, fullName: true, email: true, traineeNo: true } },
      course: { select: { id: true, name: true, code: true, passMarkPct: true } },
      certificate: { select: { id: true, studentNumber: true } },
    },
  });

  if (!attempt) return apiNotFound("Attempt");

  const flags = Array.isArray(attempt.integrityFlags)
    ? (attempt.integrityFlags as Array<{ type?: unknown; at?: unknown; reviewed?: unknown }>).map(
        (flag, index) => ({
          index,
          type: typeof flag.type === "string" ? flag.type : "unknown",
          at: typeof flag.at === "string" ? flag.at : null,
          reviewed: flag.reviewed === true,
        }),
      )
    : [];

  const { integrityFlags: _omit, ...rest } = attempt;
  void _omit;

  return apiOk({ ...rest, flags, linkState: linkState(attempt) });
}
