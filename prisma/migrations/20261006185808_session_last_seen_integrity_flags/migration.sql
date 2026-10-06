-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "integrityFlags" JSONB;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);
