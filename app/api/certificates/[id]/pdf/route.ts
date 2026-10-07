import { guard } from "@/lib/api/guard";
import { apiFail } from "@/lib/api/response";
import { viaCourse } from "@/lib/auth/scope";
import { renderCertificatePdf } from "@/lib/certificates/render";
import { prisma } from "@/lib/db";

/**
 * GET /api/certificates/:id/pdf
 *
 * Returns the printed certificate as a download.
 *
 * `certificate.read` covers this rather than a separate grant: a revoke-only actor
 * (the owner) already holds read. The response is `private, no-store` — this is
 * personal data in a file, so it must not sit in a shared cache or a back button.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const gate = await guard("certificate.read", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  /* Ownership first: a trainer must not be able to render another trainer's certificate. */
  if (gate.trainerScope) {
    const owned = await prisma.certificate.findFirst({
      where: { id, ...viaCourse(gate.trainerScope) },
      select: { id: true },
    });
    if (!owned) return apiFail("That certificate does not exist.", 404);
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
    /* Never surface a renderer stack trace or a font path to the caller. */
    return apiFail("The certificate PDF could not be generated.", 500, {
      logError: error,
    });
  }
}
