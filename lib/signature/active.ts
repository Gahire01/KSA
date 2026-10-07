import { prisma } from "@/lib/db";

export interface ActiveSignature {
  id: string;
  imageUrl: string;
  signerName: string;
  signerTitle: string;
}

/** The currently locked signature, or null when none has been locked yet. */
export async function getActiveSignature(): Promise<ActiveSignature | null> {
  return prisma.signature.findFirst({
    where: { isActive: true },
    select: { id: true, imageUrl: true, signerName: true, signerTitle: true },
  });
}
