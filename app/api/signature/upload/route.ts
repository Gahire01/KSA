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

  const created = await prisma.signature.create({
    data: {
      imageKey: "pending",
      imageUrl: "pending",
      imageData: new Uint8Array(cleaned.data),
      signerName: meta.data.signerName,
      signerTitle: meta.data.signerTitle,
      source: meta.data.source,
      createdById: gate.session.user.id,
    },
    select: { id: true },
  });

  /* The id is only known after insert, so the render URL is set second. */
  const imageUrl = `/api/signature/${created.id}/image`;
  const row = await prisma.signature.update({
    where: { id: created.id },
    data: { imageKey: `db:${created.id}`, imageUrl },
    select: { id: true, imageUrl: true, signerName: true, signerTitle: true, source: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: gate.session.user.id,
      actorEmail: gate.session.user.email,
      action: "signature.upload",
      entityType: "Signature",
      entityId: row.id,
      meta: JSON.stringify({ source: row.source, signerName: row.signerName }),
    },
  });

  return apiOk(row, 201);
}
