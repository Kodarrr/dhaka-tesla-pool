-- AlterTable
ALTER TABLE "Pool" ADD COLUMN "shareable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RideRequest" ADD COLUMN "openToShare" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maxShareSeats" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Pool_shareable_stage_pickupZone_idx" ON "Pool"("shareable", "stage", "pickupZone");
