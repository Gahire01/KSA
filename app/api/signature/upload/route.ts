import { randomBytes } from "node:crypto";

import { guard } from "@/lib/api/guard";
import { clientKey, rateLimit, rateLimitFail } from "@/lib/api/rate-limit";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { signatureMetaSchema } from "@/lib/api/signature-schemas";
import { prisma } from "@/lib/db";
import { MAX_SIGNATURE_BYTES, cleanPng } from "@/lib/signature/png";

/**
 * POST /api/signature/upload (multipart: file, signerName, signerTitle, source)
 *
 * Owner only. Stores the cleaned PNG as an INACTIVE draft; nothing prints on a
 * certificate until the owner explicitly locks it via /api/signature/lock.
 */
export async function POST(request: Request) {
  const gate = await guard("signature.manage");
  if (!gate.ok) return gate.response;

  const limit = rateLimit(clientKey(request, "signature-upload"), 5, 60 * 1000);
  if (!limit.ok) return rateLimitFail(limit.retryAfterSeconds);

  const form = await request.formData().catch(() => null);
  if (!form) return apiFail("Send the signature as a form upload.", 400);

  const file = form.get("file");
  if (!(file instanceof File)) return apiFail("Attach a PNG image.", 422);
  if (file.size > MAX_SIGNATURE_BYTES) return apiFail("The image is larger than 2 MB.", 413);

  const meta = signatureMetaSchema.safeParse({
    signerName: form.get("signerName"),
    signerTitle: form.get("signerTitle"),
    source: form.get("source"),
  });
  if (!meta.success) return apiFail(zodMessage(meta.error), 422);

  const cleaned = cleanPng(Buffer.from(await file.arrayBuffer()));
  if (!cleaned.ok) return apiFail(cleaned.error, 422);

  /* Id is generated up front so the render URL is known at insert: one atomic
   * write, never a draft left holding a placeholder URL. */
  const id = randomBytes(16).toString("hex");

  try {
    const row = await prisma.signature.create({
      data: {
        id,
        imageKey: `db:${id}`,
        imageUrl: `/api/signature/${id}/image`,
        imageData: new Uint8Array(cleaned.data),
        signerName: meta.data.signerName,
        signerTitle: meta.data.signerTitle,
        source: meta.data.source,
        createdById: gate.session.user.id,
      },
      select: { id: true, imageUrl: true, signerName: true, signerTitle: true, source: true },
    });

    /* The draft exists; a failed log write must not report the upload as failed. */
    await prisma.auditLog
      .create({
        data: {
          actorId: gate.session.user.id,
          actorEmail: gate.session.user.email,
          action: "signature.upload",
          entityType: "Signature",
          entityId: row.id,
          meta: JSON.stringify({ source: row.source, signerName: row.signerName }),
        },
      })
      .catch((error: unknown) => console.error("[signature] audit write failed", error));

    return apiOk(row, 201);
  } catch (error) {
    return apiFail("Could not save the signature. Try again.", 500, { logError: error });
  }
}
