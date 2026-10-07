import { z } from "zod";

import { guard } from "@/lib/api/guard";
import { clientKey, rateLimit, rateLimitFail } from "@/lib/api/rate-limit";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { viaCourse } from "@/lib/auth/scope";
import { prisma } from "@/lib/db";
import { lookupWhatsapp, normalizeE164, whatsappConfigured } from "@/lib/whatsapp/twilio";

const bodySchema = z
  .object({ traineeIds: z.array(z.string().trim().min(1).max(64)).min(1).max(100) })
  .strict();

/**
 * POST /api/whatsapp/lookup { traineeIds }
 *
 * Resolves each trainee's phone number to E.164 and (when Twilio is configured)
 * checks it is on WhatsApp, so staff can see the number a message would go to
 * before sending. 20 requests a minute per IP.
 *
 * Numbers are resolved from the database by trainee id; the client never posts a
 * number to be looked up, so this cannot be used as a general phone-checking
 * service.
 */
export async function POST(request: Request) {
  const gate = await guard("exam.send", { trainerScoped: true });
  if (!gate.ok) return gate.response;

  const limit = rateLimit(clientKey(request, "whatsapp-lookup"), 20, 60 * 1000);
  if (!limit.ok) return rateLimitFail(limit.retryAfterSeconds);

  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const trainees = await prisma.trainee.findMany({
    where: { id: { in: parsed.data.traineeIds }, ...viaCourse(gate.trainerScope) },
    select: { id: true, phone: true, countryCode: true },
  });

  const configured = whatsappConfigured();

  const items = await Promise.all(
    trainees.map(async (t) => {
      const e164 = normalizeE164(t.phone, t.countryCode);
      if (!e164) return { traineeId: t.id, e164: null, whatsapp: "invalid" as const };
      return {
        traineeId: t.id,
        e164,
        whatsapp: configured ? await lookupWhatsapp(e164) : ("unknown" as const),
      };
    }),
  );

  return apiOk({ configured, items });
}
