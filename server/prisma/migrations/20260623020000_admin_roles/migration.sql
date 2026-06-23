-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUser_role_isActive_idx" ON "AdminUser"("role", "isActive");

-- CreateIndex
CREATE INDEX "AdminUser_department_isActive_idx" ON "AdminUser"("department", "isActive");

-- AlterTable
ALTER TABLE "AuditLog"
ADD COLUMN "actorAdminId" TEXT,
ADD COLUMN "actorUsername" TEXT,
ADD COLUMN "actorRole" TEXT,
ADD COLUMN "actorDepartment" TEXT,
ADD COLUMN "targetAdminId" TEXT,
ADD COLUMN "targetRole" TEXT,
ADD COLUMN "targetDepartment" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_actorRole_actorDepartment_idx" ON "AuditLog"("actorRole", "actorDepartment");
