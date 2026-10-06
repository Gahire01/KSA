import { apiFail, apiOk } from "@/lib/api/response";
import { getPublicCertificate } from "@/lib/certificates/verify";

/**
 * GET /api/verify/:token — public certificate verification.
 *
 * Deliberately unauthenticated: the whole point is that an employer can check a
 * certificate without an account. That makes it the most scraped endpoint in the
 * app, so the projection in `getPublicCertificate` is kept to what an employer
 * actually needs.
 *
 * A revoked certificate returns 200 with `status: "REVOKED"` rather than an error,
 * because the public page needs to say *why* it was withdrawn. Only a token that
 * matches nothing is a 404.
 */

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  const cert = await getPublicCertificate(token);
  if (!cert) return apiFail("That verification link is not valid.", 404);

  return apiOk(cert, 200, { "Cache-Control": "public, max-age=60" });
}
