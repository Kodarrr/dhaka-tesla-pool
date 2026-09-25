-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "corridorId" TEXT;

-- AlterTable
ALTER TABLE "RideRequest" ADD COLUMN     "corridorId" TEXT,
ADD COLUMN     "fareBreakdown" JSONB;

-- CreateIndex
CREATE INDEX "Pool_corridorId_idx" ON "Pool"("corridorId");
