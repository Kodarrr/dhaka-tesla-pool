/*
  Warnings:

  - The values [STARTED] on the enum `Stage` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `startedAt` on the `Pool` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Stage_new" AS ENUM ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Pool" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "RideRequest" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Pool" ALTER COLUMN "stage" TYPE "Stage_new" USING ("stage"::text::"Stage_new");
ALTER TABLE "RideRequest" ALTER COLUMN "stage" TYPE "Stage_new" USING ("stage"::text::"Stage_new");
ALTER TYPE "Stage" RENAME TO "Stage_old";
ALTER TYPE "Stage_new" RENAME TO "Stage";
DROP TYPE "Stage_old";
ALTER TABLE "Pool" ALTER COLUMN "stage" SET DEFAULT 'REQUESTED';
ALTER TABLE "RideRequest" ALTER COLUMN "stage" SET DEFAULT 'REQUESTED';
COMMIT;

-- AlterTable
ALTER TABLE "Pool" DROP COLUMN "startedAt";

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rideRequestId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_rideRequestId_key" ON "Review"("rideRequestId");

-- CreateIndex
CREATE INDEX "Review_driverId_idx" ON "Review"("driverId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_rideRequestId_fkey" FOREIGN KEY ("rideRequestId") REFERENCES "RideRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
