import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/**
 * GET /api/signature/:id/image
 *
 * Public for any signature that has been locked (it is printed on public
 * certificates and the verify page). A draft that was never locked is visible
 * to the owner only. Bytes are immutable per id, so they cache hard.
 *
 * Serves raw image bytes, so failures are plain status codes rather than the
 * JSON envelope: an <img> tag cannot use a JSON body.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const row = await prisma.signature.findUnique({
      where: { id },
      select: { imageData: true, lockedAt: true },
    });
    if (!row) return new Response("Not found", { status: 404 });

    if (!row.lockedAt) {
      const session = await getSession();
      if (!session || session.user.role !== "OWNER") {
        return new Response("Not found", { status: 404 });
      }
    }

    return new Response(new Uint8Array(row.imageData), {
      headers: {
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
        "Cache-Control": row.lockedAt ? "public, max-age=31536000, immutable" : "private, no-store",
      },
    });
  } catch (error) {
    console.error("[signature] image read failed", error);
    return new Response("Unavailable", { status: 503 });
  }
}
