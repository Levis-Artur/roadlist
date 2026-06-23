-- AlterTable
ALTER TABLE "RouteSheet"
ADD COLUMN "adminVerifiedAt" TIMESTAMP(3),
ADD COLUMN "adminVerifiedBy" TEXT,
ADD COLUMN "adminReviewComment" TEXT;
