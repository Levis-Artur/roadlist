-- CreateTable
CREATE TABLE "Officer" (
    "id" TEXT NOT NULL,
    "badgeNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Officer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteSheet" (
    "id" TEXT NOT NULL,
    "badgeNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "crewNumber" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "startOdometer" INTEGER NOT NULL,
    "endOdometer" INTEGER,
    "distanceKm" INTEGER,
    "startPhotoId" TEXT,
    "endPhotoId" TEXT,
    "startOcrValue" INTEGER,
    "endOcrValue" INTEGER,
    "startManualEntry" BOOLEAN NOT NULL,
    "endManualEntry" BOOLEAN,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdometerPhoto" (
    "id" TEXT NOT NULL,
    "routeSheetId" TEXT,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OdometerPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "badgeNumber" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Officer_badgeNumber_key" ON "Officer"("badgeNumber");

-- CreateIndex
CREATE INDEX "RouteSheet_badgeNumber_status_idx" ON "RouteSheet"("badgeNumber", "status");

-- CreateIndex
CREATE INDEX "RouteSheet_crewNumber_vehicleNumber_status_idx" ON "RouteSheet"("crewNumber", "vehicleNumber", "status");

-- CreateIndex
CREATE INDEX "RouteSheet_createdAt_idx" ON "RouteSheet"("createdAt");

-- Prevent concurrent requests from creating two active shifts for one officer.
CREATE UNIQUE INDEX "RouteSheet_one_active_per_badge_idx" ON "RouteSheet"("badgeNumber") WHERE "status" = 'active';

-- CreateIndex
CREATE INDEX "OdometerPhoto_routeSheetId_idx" ON "OdometerPhoto"("routeSheetId");

-- CreateIndex
CREATE INDEX "OdometerPhoto_expiresAt_deletedAt_idx" ON "OdometerPhoto"("expiresAt", "deletedAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "OdometerPhoto" ADD CONSTRAINT "OdometerPhoto_routeSheetId_fkey" FOREIGN KEY ("routeSheetId") REFERENCES "RouteSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
