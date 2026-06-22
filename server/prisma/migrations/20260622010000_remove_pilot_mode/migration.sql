DROP INDEX IF EXISTS "Vehicle_department_isActive_isPilotActive_idx";

ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "isPilotActive";
CREATE INDEX IF NOT EXISTS "Vehicle_department_isActive_idx" ON "Vehicle"("department", "isActive");

ALTER TABLE "RouteSheet"
  DROP COLUMN IF EXISTS "isPilot",
  DROP COLUMN IF EXISTS "pilotDepartment",
  DROP COLUMN IF EXISTS "pilotComment";

DROP TABLE IF EXISTS "PilotOfficerAccess";
