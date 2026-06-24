ALTER TABLE "Officer" ADD COLUMN "unit" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "unit" TEXT;
ALTER TABLE "VehicleMonthlyRouteSheet" ADD COLUMN "unit" TEXT;
ALTER TABLE "RouteSheet" ADD COLUMN "unit" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "unit" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "targetUnit" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorUnit" TEXT;

CREATE TABLE "VehicleTransferHistory" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "vehicleNumber" TEXT NOT NULL,
  "displayVehicleNumber" TEXT,
  "fromDepartment" TEXT,
  "fromUnit" TEXT,
  "toDepartment" TEXT NOT NULL,
  "toUnit" TEXT,
  "comment" TEXT,
  "transferredByAdminId" TEXT,
  "transferredByUsername" TEXT,
  "transferredByRole" TEXT,
  "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VehicleTransferHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleTransferHistory_vehicleId_idx" ON "VehicleTransferHistory"("vehicleId");
CREATE INDEX "VehicleTransferHistory_toDepartment_toUnit_idx" ON "VehicleTransferHistory"("toDepartment", "toUnit");
CREATE INDEX "VehicleTransferHistory_transferredAt_idx" ON "VehicleTransferHistory"("transferredAt");

ALTER TABLE "VehicleTransferHistory"
  ADD CONSTRAINT "VehicleTransferHistory_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
