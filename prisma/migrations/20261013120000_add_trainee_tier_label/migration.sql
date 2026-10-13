-- AlterTable
ALTER TABLE "Trainee" ADD COLUMN     "tierLabel" TEXT;

-- CreateIndex
CREATE INDEX "Trainee_courseId_tierLabel_idx" ON "Trainee"("courseId", "tierLabel");
