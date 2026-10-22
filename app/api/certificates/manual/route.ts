import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { rateLimit } from "@/lib/api/rate-limit";
import { verifyPassword } from "@/lib/auth/password";
import { canIssueManualCertificate, manualCertificateSchema } from "@/lib/certificates/manual-policy";
import { issueManualCertificate, ManualCertificateError } from "@/lib/certificates/manual";
import { renderCertificatePdf } from "@/lib/certificates/render";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await guard("certificate.issue");
  if (!gate.ok) return gate.response;
  const { session } = gate;
  if (!canIssueManualCertificate(session.user) || session.accessLinkId || session.referralCodeId || session.user.lockedAt) {
    return apiFail("Manual issuance is restricted to the approved administrators signed in with their own account.", 403);
  }
  const limit = rateLimit(`certificate:manual:${session.user.id}`, 5, 15 * 60_000);
  if (!limit.ok) return apiFail("Too many attempts. Try again in 15 minutes.", 429);
  const parsed = manualCertificateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);
  if (!await verifyPassword(session.user.passwordHash, parsed.data.password)) {
    return apiFail("Incorrect admin password.", 403);
  }
  try {
    const { password: _password, ...input } = parsed.data;
    void _password;
    const certificate = await issueManualCertificate(input, session.user);
    // A render failure must not invite resubmission and create a second record.
    let pdfReady = false;
    try { pdfReady = Boolean(await renderCertificatePdf(certificate.id)); }
    catch { console.error("[certificates] manual PDF needs retry", certificate.id); }
    return apiOk({ certificate, pdfReady }, 201, { "Cache-Control": "no-store" });
  } catch (error) {
    if (error instanceof ManualCertificateError) return apiFail(error.message, 422);
    return apiFail("Certificate could not be issued. Please try again.", 500, { logError: error });
  }
}
