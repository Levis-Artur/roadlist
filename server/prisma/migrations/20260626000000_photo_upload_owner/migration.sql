-- Track the officer who uploaded an odometer photo before it is attached to a route sheet.
ALTER TABLE "OdometerPhoto" ADD COLUMN "uploadedByBadgeNumber" TEXT;

CREATE INDEX "OdometerPhoto_uploadedByBadgeNumber_idx" ON "OdometerPhoto"("uploadedByBadgeNumber");
