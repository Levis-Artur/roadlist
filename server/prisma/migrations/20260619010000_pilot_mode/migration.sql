-- AlterTable
ALTER TABLE "RouteSheet"
ADD COLUMN "isPilot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pilotDepartment" TEXT,
ADD COLUMN "pilotComment" TEXT;

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "isPilotActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotOfficerAccess" (
    "id" TEXT NOT NULL,
    "badgeNumber" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotOfficerAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");
CREATE INDEX "Vehicle_department_isPilotActive_idx" ON "Vehicle"("department", "isPilotActive");
CREATE UNIQUE INDEX "PilotOfficerAccess_badgeNumber_key" ON "PilotOfficerAccess"("badgeNumber");
CREATE INDEX "PilotOfficerAccess_department_isActive_idx" ON "PilotOfficerAccess"("department", "isActive");
