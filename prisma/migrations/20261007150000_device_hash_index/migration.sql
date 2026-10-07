-- CreateIndex
CREATE INDEX "DeviceSession_accessLinkId_deviceHash_idx" ON "DeviceSession"("accessLinkId", "deviceHash");
