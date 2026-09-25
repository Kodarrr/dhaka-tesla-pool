import { prisma } from '../../lib/prisma.js';

export class DriverError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export async function acceptPool(driverId: string, poolId: string) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) throw new DriverError(403, 'No Tesla registered for this driver');

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) throw new DriverError(404, 'Pool not found');
  if (pool.stage !== 'REQUESTED') throw new DriverError(409, 'Pool is not in REQUESTED state');

  return prisma.pool.update({
    where: { id: poolId },
    data: { stage: 'MATCHED', teslaId: tesla.id, matchedAt: new Date() },
    include: {
      rideRequests: { include: { passenger: { select: { id: true, name: true } } } },
      tesla: true,
    },
  });
}

export async function markArrived(driverId: string, poolId: string) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) throw new DriverError(403, 'No Tesla registered for this driver');

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) throw new DriverError(404, 'Pool not found');
  if (pool.teslaId !== tesla.id)
    throw new DriverError(403, 'This pool is not assigned to your Tesla');
  if (pool.stage !== 'MATCHED')
    throw new DriverError(409, 'Pool must be MATCHED before marking arrived');

  // Update pool + all active ride requests atomically
  const [updatedPool] = await prisma.$transaction([
    prisma.pool.update({
      where: { id: poolId },
      data: { stage: 'DRIVER_ARRIVED', arrivedAt: new Date() },
      include: {
        rideRequests: { include: { passenger: { select: { id: true, name: true } } } },
        tesla: true,
      },
    }),
    prisma.rideRequest.updateMany({
      where: { poolId, stage: { in: ['REQUESTED', 'MATCHED'] } },
      data: { stage: 'DRIVER_ARRIVED' },
    }),
  ]);
  return updatedPool;
}

export async function completeTrip(driverId: string, poolId: string) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) throw new DriverError(403, 'No Tesla registered for this driver');

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) throw new DriverError(404, 'Pool not found');
  if (pool.teslaId !== tesla.id)
    throw new DriverError(403, 'This pool is not assigned to your Tesla');
  if (pool.stage !== 'DRIVER_ARRIVED')
    throw new DriverError(409, 'Pool must be DRIVER_ARRIVED before completing');

  const [updatedPool] = await prisma.$transaction([
    prisma.pool.update({
      where: { id: poolId },
      data: { stage: 'COMPLETED', completedAt: new Date() },
      include: {
        rideRequests: { include: { passenger: { select: { id: true, name: true } } } },
        tesla: true,
      },
    }),
    prisma.rideRequest.updateMany({
      where: { poolId, stage: 'DRIVER_ARRIVED' },
      data: { stage: 'COMPLETED' },
    }),
  ]);
  return updatedPool;
}
