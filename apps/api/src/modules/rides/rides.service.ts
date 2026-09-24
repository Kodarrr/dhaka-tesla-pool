import { prisma } from '../../lib/prisma.js';
import { calculateFare } from '../../config/fare.js';
import { Zone } from '../../config/zones.js';
import { EstimateRideInput, RequestRideInput } from './rides.schema.js';

export class RideError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export async function estimateRide(input: EstimateRideInput) {
  const pickupZone = input.pickupZone as Zone;
  const dropoffZone = (input.dropoffZone || input.destinationZone) as Zone;
  const passengerCount = input.passengerCount ?? input.seats ?? 1;

  const fareResult = calculateFare(pickupZone, dropoffZone, passengerCount);

  // Dynamic pooling options for 1, 2, and 3 riders
  const poolOptions = [1, 2, 3].map((count) => {
    const f = calculateFare(pickupZone, dropoffZone, count);
    return {
      passengers: count,
      discountPercentage: f.discountPercentage,
      perPersonFareBDT: f.perPersonFareBDT,
      totalFareBDT: f.totalFareBDT,
      totalFarePaisa: f.totalFarePaisa,
    };
  });

  // Check existing pools in this pickup zone that are currently waiting for riders/drivers
  const availablePools = await prisma.pool.findMany({
    where: {
      pickupZone,
      stage: { in: ['REQUESTED', 'MATCHED'] },
    },
    include: {
      rideRequests: {
        select: {
          id: true,
          destinationZone: true,
          seats: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    pickupZone,
    dropoffZone,
    distanceKm: fareResult.distanceKm,
    passengerCount,
    perPersonFareBDT: fareResult.perPersonFareBDT,
    totalFareBDT: fareResult.totalFareBDT,
    discountPercentage: fareResult.discountPercentage,
    fareDetails: fareResult,
    poolOptions,
    availablePoolsCount: availablePools.length,
    availablePools,
  };
}

export async function requestRide(passengerId: string, input: RequestRideInput) {
  const pickupZone = input.pickupZone as Zone;
  const destinationZone = (input.destinationZone || input.dropoffZone) as Zone;
  const seats = input.seats ?? input.passengerCount ?? 1;

  // 1. Validate if user already has an active ride (REQUESTED, MATCHED, DRIVER_ARRIVED, STARTED)
  const activeRide = await prisma.rideRequest.findFirst({
    where: {
      passengerId,
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED'] },
    },
  });

  if (activeRide) {
    throw new RideError(409, 'User already has an active ride in progress');
  }

  // 2. Calculate fare for this request
  const fare = calculateFare(pickupZone, destinationZone, seats);

  // 3. Match into an existing open pool in the pickup zone or create a new pool
  const candidatePool = await prisma.pool.findFirst({
    where: {
      pickupZone,
      stage: 'REQUESTED',
    },
    orderBy: { createdAt: 'desc' },
  });

  let assignedPoolId: string;

  if (candidatePool && candidatePool.seatsCap - candidatePool.seatsTaken >= seats) {
    // Join existing open pool
    await prisma.pool.update({
      where: { id: candidatePool.id },
      data: { seatsTaken: candidatePool.seatsTaken + seats },
    });
    assignedPoolId = candidatePool.id;
  } else {
    // Create new open pool with capacity 3
    const newPool = await prisma.pool.create({
      data: {
        pickupZone,
        seatsCap: 3,
        seatsTaken: seats,
        stage: 'REQUESTED',
      },
    });
    assignedPoolId = newPool.id;
  }

  // 4. Create the RideRequest record
  const rideRequest = await prisma.rideRequest.create({
    data: {
      passengerId,
      poolId: assignedPoolId,
      pickupZone,
      destinationZone,
      seats,
      stage: 'REQUESTED',
      baseFarePaisa: fare.baseFarePaisa,
      distanceChargePaisa: fare.distanceChargePaisa,
      poolDiscountPaisa: fare.poolDiscountPaisa,
      totalFarePaisa: fare.totalFarePaisa,
    },
    include: {
      pool: true,
    },
  });

  return {
    ...rideRequest,
    fareSummary: {
      totalFareBDT: fare.totalFareBDT,
      perPersonFareBDT: fare.perPersonFareBDT,
      discountPercentage: fare.discountPercentage,
    },
  };
}

export async function getMyRides(passengerId: string) {
  return prisma.rideRequest.findMany({
    where: { passengerId },
    orderBy: { createdAt: 'desc' },
    include: {
      pool: {
        include: {
          tesla: true,
        },
      },
    },
  });
}

export async function getActiveRides() {
  const activePools = await prisma.pool.findMany({
    where: {
      stage: { in: ['REQUESTED', 'MATCHED'] },
    },
    include: {
      rideRequests: {
        include: {
          passenger: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      tesla: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeRequests = await prisma.rideRequest.findMany({
    where: {
      stage: { in: ['REQUESTED', 'MATCHED'] },
    },
    include: {
      passenger: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      pool: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    activePoolsCount: activePools.length,
    activeRequestsCount: activeRequests.length,
    activePools,
    activeRequests,
  };
}