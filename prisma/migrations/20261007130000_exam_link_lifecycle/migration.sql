-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "linkMaxUses" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "linkUses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "firstOpenedAt" TIMESTAMP(3),
ADD COLUMN     "firstOpenedIp" TEXT,
ADD COLUMN     "firstOpenedUa" TEXT;

-- Attempts that were already opened before this migration have used their link.
UPDATE "ExamAttempt" SET "linkUses" = 1, "firstOpenedAt" = "startedAt" WHERE "startedAt" IS NOT NULL;
