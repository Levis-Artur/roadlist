ALTER TABLE "Department" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Department" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Department" ADD COLUMN "deletedByAdminId" TEXT;
ALTER TABLE "Department" ADD COLUMN "deletedByUsername" TEXT;
ALTER TABLE "Department" ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "DepartmentUnit" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DepartmentUnit" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "DepartmentUnit" ADD COLUMN "deletedByAdminId" TEXT;
ALTER TABLE "DepartmentUnit" ADD COLUMN "deletedByUsername" TEXT;
ALTER TABLE "DepartmentUnit" ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "Vehicle" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vehicle" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "deletedByAdminId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "deletedByUsername" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "Officer" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Officer" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Officer" ADD COLUMN "deletedByAdminId" TEXT;
ALTER TABLE "Officer" ADD COLUMN "deletedByUsername" TEXT;
ALTER TABLE "Officer" ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "RouteSheet" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RouteSheet" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "RouteSheet" ADD COLUMN "deletedByAdminId" TEXT;
ALTER TABLE "RouteSheet" ADD COLUMN "deletedByUsername" TEXT;
ALTER TABLE "RouteSheet" ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "VehicleMonthlyRouteSheet" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VehicleMonthlyRouteSheet" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "VehicleMonthlyRouteSheet" ADD COLUMN "deletedByAdminId" TEXT;
ALTER TABLE "VehicleMonthlyRouteSheet" ADD COLUMN "deletedByUsername" TEXT;
ALTER TABLE "VehicleMonthlyRouteSheet" ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "AdminUser" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdminUser" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN "deletedByAdminId" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "deletedByUsername" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "deleteReason" TEXT;

ALTER TABLE "OdometerPhoto" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OdometerPhoto" ADD COLUMN "deletedByAdminId" TEXT;
ALTER TABLE "OdometerPhoto" ADD COLUMN "deletedByUsername" TEXT;
ALTER TABLE "OdometerPhoto" ADD COLUMN "deleteReason" TEXT;

CREATE INDEX "Department_isDeleted_isActive_idx" ON "Department"("isDeleted", "isActive");
CREATE INDEX "DepartmentUnit_isDeleted_departmentId_idx" ON "DepartmentUnit"("isDeleted", "departmentId");
CREATE INDEX "Vehicle_isDeleted_isActive_idx" ON "Vehicle"("isDeleted", "isActive");
CREATE INDEX "Officer_isDeleted_isActive_idx" ON "Officer"("isDeleted", "isActive");
CREATE INDEX "RouteSheet_isDeleted_status_idx" ON "RouteSheet"("isDeleted", "status");
CREATE INDEX "VehicleMonthlyRouteSheet_isDeleted_status_idx" ON "VehicleMonthlyRouteSheet"("isDeleted", "status");
CREATE INDEX "AdminUser_isDeleted_isActive_idx" ON "AdminUser"("isDeleted", "isActive");
