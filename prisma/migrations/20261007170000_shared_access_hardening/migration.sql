-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "referralCodeId" TEXT;

-- AlterTable
ALTER TABLE "ReferralCode" ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Session_referralCodeId_idx" ON "Session"("referralCodeId");

-- A device holds at most one slot per link / per code.
CREATE UNIQUE INDEX "DeviceSession_accessLinkId_deviceHash_key" ON "DeviceSession"("accessLinkId", "deviceHash");
CREATE UNIQUE INDEX "DeviceSession_referralCodeId_deviceHash_key" ON "DeviceSession"("referralCodeId", "deviceHash");

-- A trainee has at most one sitting per attempt number on a course.
CREATE UNIQUE INDEX "ExamAttempt_traineeId_courseId_attemptNumber_key" ON "ExamAttempt"("traineeId", "courseId", "attemptNumber");
