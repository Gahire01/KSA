import { z } from "zod";

import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/**
 * GET /api/auth/me
 *
 * The identity behind the request cookie: 401 when there is none, expired or
 * belongs to a deactivated account, and `{ id, email, role, name }` when there
 * is. The password hash, TOTP secret and session id never appear here.
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return apiFail("Sign in to continue.", 401);
  }

  return apiOk({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    name: session.user.name || session.user.email.split("@")[0],
  });
}

const patchSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  })
  .strict();

/**
 * PATCH /api/auth/me — update the signed-in user's own display name.
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return apiFail("Sign in to continue.", 401);

  const body: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
    select: { id: true, email: true, role: true, name: true },
  });

  return apiOk({
    id: updated.id,
    email: updated.email,
    role: updated.role,
    name: updated.name || updated.email.split("@")[0],
  });
}
