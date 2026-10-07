import { guard } from "@/lib/api/guard";
import { apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/db";

/** GET /api/signature — the active signature and recent history (owner only). */
export async function GET() {
  const gate = await guard("signature.manage");
  if (!gate.ok) return gate.response;

  const rows = await prisma.signature.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      imageUrl: true,
      signerName: true,
      signerTitle: true,
      source: true,
      isActive: true,
      lockedAt: true,
      supersededAt: true,
      createdAt: true,
    },
  });

  return apiOk({ active: rows.find((r) => r.isActive) ?? null, items: rows });
}
