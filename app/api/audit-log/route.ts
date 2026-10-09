import { z } from "zod";

import { guard } from "@/lib/api/guard";
import { apiFail, apiOk, zodMessage } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * GET /api/audit-log — the append-only trail of privileged actions. Owner only.
 *
 * Read-only by design: there is no POST, PATCH or DELETE here or anywhere else, so
 * nothing in the app can change or remove a row once it is written.
 */

const querySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    action: z.string().trim().max(120).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

function parseMeta(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function GET(request: Request) {
  const gate = await guard("audit.read");
  if (!gate.ok) return gate.response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);
  const q = parsed.data;

  const where: Prisma.AuditLogWhereInput = {
    ...(q.action ? { action: q.action } : {}),
    /* `to` is a calendar day from the date picker, so it runs to the end of that day. */
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: new Date(q.to.getTime() + 86_399_999) } : {}) } }
      : {}),
    ...(q.search
      ? {
          OR: [
            { action: { contains: q.search, mode: "insensitive" } },
            { actorEmail: { contains: q.search, mode: "insensitive" } },
            { entityType: { contains: q.search, mode: "insensitive" } },
            { entityId: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        createdAt: true,
        actorEmail: true,
        action: true,
        entityType: true,
        entityId: true,
        meta: true,
        ip: true,
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
  ]);

  return apiOk({
    items: rows.map((row) => ({
      id: row.id,
      at: row.createdAt.toISOString(),
      actorEmail: row.actorEmail,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      meta: parseMeta(row.meta),
      ip: row.ip,
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    actions: actions.map((a) => a.action),
  });
}
