-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Vehicle" ALTER COLUMN "isPilotActive" SET DEFAULT false;

-- DropIndex
DROP INDEX "Vehicle_department_isPilotActive_idx";

-- CreateIndex
CREATE INDEX "Vehicle_department_isActive_isPilotActive_idx" ON "Vehicle"("department", "isActive", "isPilotActive");
