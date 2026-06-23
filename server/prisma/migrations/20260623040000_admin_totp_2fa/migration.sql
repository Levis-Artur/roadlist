-- AlterTable
ALTER TABLE "AdminUser"
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "twoFactorSecret" TEXT,
ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3),
ADD COLUMN "twoFactorLastVerifiedAt" TIMESTAMP(3),
ADD COLUMN "twoFactorRecoveryCodesHash" TEXT;

-- CreateIndex
CREATE INDEX "AdminUser_twoFactorEnabled_idx" ON "AdminUser"("twoFactorEnabled");
