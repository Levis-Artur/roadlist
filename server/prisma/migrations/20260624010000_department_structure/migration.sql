CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "region" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepartmentUnit" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT,
  "code" TEXT,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DepartmentUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");
CREATE INDEX "Department_region_idx" ON "Department"("region");
CREATE UNIQUE INDEX "DepartmentUnit_departmentId_name_key" ON "DepartmentUnit"("departmentId", "name");
CREATE INDEX "DepartmentUnit_departmentId_isActive_idx" ON "DepartmentUnit"("departmentId", "isActive");

ALTER TABLE "DepartmentUnit"
  ADD CONSTRAINT "DepartmentUnit_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Officer" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Officer" ADD COLUMN "departmentName" TEXT;
ALTER TABLE "Officer" ADD COLUMN "departmentUnitId" TEXT;
ALTER TABLE "Officer" ADD COLUMN "departmentUnitName" TEXT;

ALTER TABLE "Vehicle" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "departmentName" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "departmentUnitId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "departmentUnitName" TEXT;

ALTER TABLE "VehicleMonthlyRouteSheet" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "VehicleMonthlyRouteSheet" ADD COLUMN "departmentName" TEXT;
ALTER TABLE "VehicleMonthlyRouteSheet" ADD COLUMN "departmentUnitId" TEXT;
ALTER TABLE "VehicleMonthlyRouteSheet" ADD COLUMN "departmentUnitName" TEXT;

ALTER TABLE "RouteSheet" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "RouteSheet" ADD COLUMN "departmentName" TEXT;
ALTER TABLE "RouteSheet" ADD COLUMN "departmentUnitId" TEXT;
ALTER TABLE "RouteSheet" ADD COLUMN "departmentUnitName" TEXT;

ALTER TABLE "AdminUser" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "departmentName" TEXT;

ALTER TABLE "AuditLog" ADD COLUMN "actorDepartmentId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "targetDepartmentId" TEXT;

ALTER TABLE "VehicleTransferHistory" ADD COLUMN "fromDepartmentId" TEXT;
ALTER TABLE "VehicleTransferHistory" ADD COLUMN "fromDepartmentName" TEXT;
ALTER TABLE "VehicleTransferHistory" ADD COLUMN "fromDepartmentUnitId" TEXT;
ALTER TABLE "VehicleTransferHistory" ADD COLUMN "fromDepartmentUnitName" TEXT;
ALTER TABLE "VehicleTransferHistory" ADD COLUMN "toDepartmentId" TEXT;
ALTER TABLE "VehicleTransferHistory" ADD COLUMN "toDepartmentName" TEXT;
ALTER TABLE "VehicleTransferHistory" ADD COLUMN "toDepartmentUnitId" TEXT;
ALTER TABLE "VehicleTransferHistory" ADD COLUMN "toDepartmentUnitName" TEXT;

INSERT INTO "Department" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, source."department", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "department" FROM "Officer" WHERE "department" IS NOT NULL
  UNION
  SELECT DISTINCT "department" FROM "Vehicle" WHERE "department" IS NOT NULL
  UNION
  SELECT DISTINCT "department" FROM "RouteSheet" WHERE "department" IS NOT NULL
  UNION
  SELECT DISTINCT "department" FROM "VehicleMonthlyRouteSheet" WHERE "department" IS NOT NULL
) AS source
WHERE source."department" IS NOT NULL
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "DepartmentUnit" ("id", "departmentId", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d."id", source."unit", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "department", "unit" FROM "Officer" WHERE "department" IS NOT NULL AND "unit" IS NOT NULL AND "unit" <> ''
  UNION
  SELECT DISTINCT "department", "unit" FROM "Vehicle" WHERE "department" IS NOT NULL AND "unit" IS NOT NULL AND "unit" <> ''
  UNION
  SELECT DISTINCT "department", "unit" FROM "RouteSheet" WHERE "department" IS NOT NULL AND "unit" IS NOT NULL AND "unit" <> ''
  UNION
  SELECT DISTINCT "department", "unit" FROM "VehicleMonthlyRouteSheet" WHERE "department" IS NOT NULL AND "unit" IS NOT NULL AND "unit" <> ''
) AS source
JOIN "Department" d ON d."name" = source."department"
ON CONFLICT ("departmentId", "name") DO NOTHING;

UPDATE "Officer" o
SET "departmentId" = d."id",
    "departmentName" = d."name",
    "departmentUnitId" = du."id",
    "departmentUnitName" = COALESCE(du."name", o."unit")
FROM "Department" d
LEFT JOIN "DepartmentUnit" du ON du."departmentId" = d."id" AND du."name" = o."unit"
WHERE d."name" = o."department";

UPDATE "Vehicle" v
SET "departmentId" = d."id",
    "departmentName" = d."name",
    "departmentUnitId" = du."id",
    "departmentUnitName" = COALESCE(du."name", v."unit")
FROM "Department" d
LEFT JOIN "DepartmentUnit" du ON du."departmentId" = d."id" AND du."name" = v."unit"
WHERE d."name" = v."department";

UPDATE "RouteSheet" r
SET "departmentId" = d."id",
    "departmentName" = d."name",
    "departmentUnitId" = du."id",
    "departmentUnitName" = COALESCE(du."name", r."unit")
FROM "Department" d
LEFT JOIN "DepartmentUnit" du ON du."departmentId" = d."id" AND du."name" = r."unit"
WHERE d."name" = r."department";

UPDATE "VehicleMonthlyRouteSheet" m
SET "departmentId" = d."id",
    "departmentName" = d."name",
    "departmentUnitId" = du."id",
    "departmentUnitName" = COALESCE(du."name", m."unit")
FROM "Department" d
LEFT JOIN "DepartmentUnit" du ON du."departmentId" = d."id" AND du."name" = m."unit"
WHERE d."name" = m."department";

UPDATE "AdminUser" a
SET "departmentId" = d."id",
    "departmentName" = d."name"
FROM "Department" d
WHERE d."name" = a."department";

UPDATE "VehicleTransferHistory"
SET "fromDepartmentName" = "fromDepartment",
    "fromDepartmentUnitName" = "fromUnit",
    "toDepartmentName" = "toDepartment",
    "toDepartmentUnitName" = "toUnit";

CREATE INDEX "Officer_departmentId_isActive_idx" ON "Officer"("departmentId", "isActive");
CREATE INDEX "Officer_departmentUnitId_isActive_idx" ON "Officer"("departmentUnitId", "isActive");
CREATE INDEX "Vehicle_departmentId_isActive_idx" ON "Vehicle"("departmentId", "isActive");
CREATE INDEX "Vehicle_departmentUnitId_isActive_idx" ON "Vehicle"("departmentUnitId", "isActive");
CREATE INDEX "VehicleTransferHistory_toDepartmentId_toDepartmentUnitId_idx" ON "VehicleTransferHistory"("toDepartmentId", "toDepartmentUnitId");
CREATE INDEX "VehicleMonthlyRouteSheet_departmentId_departmentUnitId_idx" ON "VehicleMonthlyRouteSheet"("departmentId", "departmentUnitId");
CREATE INDEX "RouteSheet_departmentId_departmentUnitId_idx" ON "RouteSheet"("departmentId", "departmentUnitId");
CREATE INDEX "AdminUser_departmentId_isActive_idx" ON "AdminUser"("departmentId", "isActive");
