-- CreateEnum
CREATE TYPE "SignatureSource" AS ENUM ('DRAWN', 'UPLOADED');

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "signatureUrlSnapshot" TEXT,
ADD COLUMN     "signerNameSnapshot" TEXT,
ADD COLUMN     "signerTitleSnapshot" TEXT;

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerTitle" TEXT NOT NULL,
    "source" "SignatureSource" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Signature_isActive_idx" ON "Signature"("isActive");

-- Only one active signature at a time, enforced by the database.
CREATE UNIQUE INDEX "Signature_one_active" ON "Signature"("isActive") WHERE "isActive" = true;
