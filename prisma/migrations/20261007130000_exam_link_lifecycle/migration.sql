-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "linkMaxUses" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "linkUses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "firstOpenedAt" TIMESTAMP(3),
ADD COLUMN     "firstOpenedIp" TEXT,
ADD COLUMN     "firstOpenedUa" TEXT;

-- Attempts that were already opened before this migration have used their link.
UPDATE "ExamAttempt" SET "linkUses" = 1, "firstOpenedAt" = "startedAt" WHERE "startedAt" IS NOT NULL;

-- Links already emailed before this migration have no expiry. Give open ones a
-- fresh 72-hour window so deploying does not silently expire every outstanding link.
UPDATE "ExamAttempt" SET "linkExpiresAt" = NOW() + INTERVAL '72 hours' WHERE "linkExpiresAt" IS NULL AND "status" IN ('PENDING', 'STARTED');
