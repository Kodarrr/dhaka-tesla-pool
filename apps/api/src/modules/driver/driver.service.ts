import { prisma } from '../../lib/prisma.js';
import { createNotification } from '../notifications/notifications.service.js';

export class DriverError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export async function acceptPool(driverId: string, poolId: string) {
  const tesla = await prisma.tesla.findUnique({
    where: { driverId },
    include: { driver: { select: { name: true } } },
  });
  if (!tesla) throw new DriverError(403, 'No Tesla registered for this driver');

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) throw new DriverError(404, 'Pool not found');
  if (pool.stage !== 'REQUESTED') throw new DriverError(409, 'Pool is not in REQUESTED state');

  const [updatedPool] = await prisma.$transaction([
    prisma.pool.update({
      where: { id: poolId },
      data: { stage: 'MATCHED', teslaId: tesla.id, matchedAt: new Date() },
      include: {
        rideRequests: {
          where: { stage: { not: 'CANCELLED' } },
          include: { passenger: { select: { id: true, name: true } } },
        },
        tesla: {
          include: { driver: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.rideRequest.updateMany({
      where: { poolId, stage: 'REQUESTED' },
      data: { stage: 'MATCHED' },
    }),
  ]);

  // Notify each non-cancelled passenger that their ride has been accepted
  const activeRequests = updatedPool.rideRequests.filter((r) => r.stage !== 'CANCELLED');
  const driverName = tesla.driver?.name || 'Your driver';
  await Promise.all(
    activeRequests.map((r) =>
      createNotification({
        userId: r.passengerId,
        type: 'RIDE_ACCEPTED',
        message: `${driverName} accepted your ride.`,
        rideRequestId: r.id,
        poolId: poolId,
      })
    )
  );

  return updatedPool;
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
        rideRequests: {
          where: { stage: { not: 'CANCELLED' } },
          include: { passenger: { select: { id: true, name: true } } },
        },
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

export async function arriveTrip(driverId: string, poolId: string) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) throw new DriverError(403, 'No Tesla registered for this driver');

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) throw new DriverError(404, 'Pool not found');
  if (pool.teslaId !== tesla.id)
    throw new DriverError(403, 'This pool is not assigned to your Tesla');

  const [updatedPool] = await prisma.$transaction([
    prisma.pool.update({
      where: { id: poolId },
      data: { stage: 'ARRIVED_AT_DESTINATION', arrivedAt: pool.arrivedAt ?? new Date() },
      include: {
        rideRequests: {
          where: { stage: { not: 'CANCELLED' } },
          include: { passenger: { select: { id: true, name: true } } },
        },
        tesla: true,
      },
    }),
    prisma.rideRequest.updateMany({
      where: { poolId, stage: { notIn: ['CANCELLED', 'COMPLETED'] } },
      data: { stage: 'ARRIVED_AT_DESTINATION' },
    }),
  ]);
  return updatedPool;
}

export async function completeTrip(driverId: string, poolId: string) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) throw new DriverError(403, 'No Tesla registered for this driver');

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { rideRequests: true },
  });
  if (!pool) throw new DriverError(404, 'Pool not found');
  if (pool.teslaId && pool.teslaId !== tesla.id) {
    throw new DriverError(403, 'This pool is not assigned to your Tesla');
  }

  const [updatedPool] = await prisma.$transaction([
    prisma.pool.update({
      where: { id: poolId },
      data: {
        stage: 'COMPLETED',
        completedAt: new Date(),
        teslaId: pool.teslaId ?? tesla.id,
      },
      include: {
        rideRequests: {
          where: { stage: { not: 'CANCELLED' } },
          include: { passenger: { select: { id: true, name: true } } },
        },
        tesla: true,
      },
    }),
    prisma.rideRequest.updateMany({
      where: { poolId, stage: { notIn: ['CANCELLED'] } },
      data: { stage: 'COMPLETED', paymentStatus: 'PAID' },
    }),
  ]);
  return updatedPool;
}


export async function getDriverHistory(driverId: string) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) throw new DriverError(404, 'Register a Tesla first');

  const pools = await prisma.pool.findMany({
    where: {
      teslaId: tesla.id,
      stage: 'COMPLETED',
    },
    orderBy: { completedAt: 'desc' },
    include: {
      rideRequests: {
        where: {
          stage: { not: 'CANCELLED' },
        },
        include: {
          passenger: {
            select: { name: true },
          },
        },
      },
    },
  });

  const trips = pools.map((pool) => {
    const riders = pool.rideRequests.map((r) => ({
      name: r.passenger.name,
      destinationZone: r.destinationZone,
      seats: r.seats,
      totalFarePaisa: r.totalFarePaisa,
    }));
    const tripEarningsPaisa = pool.rideRequests.reduce(
      (sum, r) => sum + r.totalFarePaisa,
      0
    );
    return {
      id: pool.id,
      pickupZone: pool.pickupZone,
      completedAt: pool.completedAt,
      riders,
      tripEarningsPaisa,
    };
  });

  const totalIncomePaisa = trips.reduce(
    (sum, t) => sum + t.tripEarningsPaisa,
    0
  );
  const completedTripCount = pools.length;

  return {
    trips,
    totalIncomePaisa,
    completedTripCount,
  };
}

export async function confirmCashPayment(driverId: string, rideRequestId: string) {
  const tesla = await prisma.tesla.findUnique({
    where: { driverId },
    include: { driver: { select: { name: true } } },
  });
  if (!tesla) throw new DriverError(403, 'No Tesla registered for this driver');

  const ride = await prisma.rideRequest.findUnique({
    where: { id: rideRequestId },
    include: { pool: true },
  });
  if (!ride) throw new DriverError(404, 'Ride request not found');
  if (ride.pool?.teslaId !== tesla.id) throw new DriverError(403, 'This ride is not in your pool');
  if (ride.paymentStatus === 'PAID') {
    return ride;
  }

  const updated = await prisma.rideRequest.update({
    where: { id: rideRequestId },
    data: { paymentMethod: 'CASH', paymentStatus: 'PAID', paidAt: new Date() },
  });

  // Notify passenger that payment is confirmed
  const driverName = tesla.driver?.name || 'Driver';
  await createNotification({
    userId: ride.passengerId,
    type: 'PAYMENT_CONFIRMED',
    message: `${driverName} confirmed receiving your cash payment.`,
    rideRequestId: rideRequestId,
    poolId: ride.poolId ?? undefined,
  });

  return updated;
}
