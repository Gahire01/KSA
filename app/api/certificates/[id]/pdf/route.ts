export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { guard } from "@/lib/api/guard";
import { apiFail } from "@/lib/api/response";
import { viaCourse } from "@/lib/auth/scope";
import { renderCertificatePdf } from "@/lib/certificates/render";
import { prisma } from "@/lib/db";
import { canTraineeDownloadCertificate } from "@/lib/certificates/trainee-access";
import { hashExamToken } from "@/lib/exams/token";
import { readExamSession } from "@/lib/exams/session-cookie";

/**
 * GET /api/certificates/:id/pdf
 *
 * Returns the printed certificate as a download.
 *
 * `certificate.read` covers this rather than a separate grant: a revoke-only actor
 * (the owner) already holds read. The response is `private, no-store` — this is
 * personal data in a file, so it must not sit in a shared cache or a back button.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const examToken = request.headers.get("X-Exam-Token");
  if (examToken !== null) {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(examToken)) return apiFail("Certificate download is not authorized.", 401);
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      select: {
        traineeId: true, courseId: true, revokedAt: true,
        attempt: { select: { id: true, traineeId: true, courseId: true, status: true, tokenHash: true } },
      },
    });
    const verified = certificate?.attempt
      ? await readExamSession(examToken, certificate.attempt.id)
      : false;
    if (!canTraineeDownloadCertificate(certificate, hashExamToken(examToken), verified)) {
      return apiFail("Certificate download is not authorized. Contact the academy if your session has expired.", 401);
    }
  } else {
    const gate = await guard("certificate.read", { trainerScoped: true });
    if (!gate.ok) return gate.response;

    /* Ownership first: trainers can only render their own course certificates. */
    if (gate.trainerScope) {
      const owned = await prisma.certificate.findFirst({
        where: { id, ...viaCourse(gate.trainerScope) },
        select: { id: true },
      });
      if (!owned) return apiFail("That certificate does not exist.", 404);
    }
  }

  try {
    const rendered = await renderCertificatePdf(id);

    if (!rendered) return apiFail("That certificate does not exist.", 404);

    return new Response(new Uint8Array(rendered.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${rendered.filename}"`,
        "Content-Length": String(rendered.buffer.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "The certificate PDF could not be generated.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
