-- CreateTable
CREATE TABLE "VehicleMonthlyRouteSheet" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "displayVehicleNumber" TEXT,
    "vehicleBrand" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openingOdometer" INTEGER,
    "closingOdometer" INTEGER,
    "totalDistanceKm" INTEGER NOT NULL DEFAULT 0,
    "totalFuelLiters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "printedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "adminCheckedBy" TEXT,
    "adminComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMonthlyRouteSheet_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "RouteSheet"
ADD COLUMN "monthlyRouteSheetId" TEXT,
ADD COLUMN "vehicleId" TEXT,
ADD COLUMN "displayVehicleNumber" TEXT,
ADD COLUMN "vehicleBrand" TEXT,
ADD COLUMN "vehicleModel" TEXT,
ADD COLUMN "refueled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fuelLiters" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMonthlyRouteSheet_vehicleId_year_month_key" ON "VehicleMonthlyRouteSheet"("vehicleId", "year", "month");

-- CreateIndex
CREATE INDEX "VehicleMonthlyRouteSheet_vehicleNumber_year_month_idx" ON "VehicleMonthlyRouteSheet"("vehicleNumber", "year", "month");

-- CreateIndex
CREATE INDEX "VehicleMonthlyRouteSheet_status_idx" ON "VehicleMonthlyRouteSheet"("status");

-- CreateIndex
CREATE INDEX "RouteSheet_vehicleNumber_status_idx" ON "RouteSheet"("vehicleNumber", "status");

-- Prevent concurrent requests from creating two active shifts for one vehicle.
CREATE UNIQUE INDEX "RouteSheet_one_active_per_vehicle_idx" ON "RouteSheet"("vehicleNumber") WHERE "status" = 'active';

-- CreateIndex
CREATE INDEX "RouteSheet_monthlyRouteSheetId_idx" ON "RouteSheet"("monthlyRouteSheetId");

-- AddForeignKey
ALTER TABLE "VehicleMonthlyRouteSheet" ADD CONSTRAINT "VehicleMonthlyRouteSheet_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteSheet" ADD CONSTRAINT "RouteSheet_monthlyRouteSheetId_fkey" FOREIGN KEY ("monthlyRouteSheetId") REFERENCES "VehicleMonthlyRouteSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
