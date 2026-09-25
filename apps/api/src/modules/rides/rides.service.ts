import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  calculateFare,
  calculateCorridorPoolFares,
  calculateSoloCorridorFare,
  RiderFareBreakdown,
} from '../../config/fare.js';
import {
  Zone,
  Corridor,
  findCorridorsForRoute,
  findCorridorForRoute,
  findCorridorById,
  findCorridorForRiders,
} from '../../config/zones.js';
import {
  EstimateRideInput,
  RequestRideInput,
  AvailableSharesQuery,
  JoinPoolInput,
} from './rides.schema.js';
import { evaluateShareCandidate, isShareJoinableStage } from './share-discovery.js';
import { createNotification } from '../notifications/notifications.service.js';

//  simple ride error handling

export class RideError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errorCode: string = 'ride_error'
  ) {
    super(message);
  }
}

// estimation of ride 
export async function estimateRide(input: EstimateRideInput) {
  const pickupZone = input.pickupZone as Zone;
  const dropoffZone = (input.dropoffZone || input.destinationZone) as Zone;
  const passengerCount = input.passengerCount ?? input.seats ?? 1;

  const corridor = findCorridorForRoute(pickupZone, dropoffZone);
  if (!corridor) {
    throw new RideError(
      400,
      `No straight-line corridor route available connecting ${pickupZone} to ${dropoffZone}`
    );
  }

  const fareResult = calculateFare(pickupZone, dropoffZone, passengerCount);
  const solo = calculateSoloCorridorFare(pickupZone, dropoffZone, passengerCount);

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

  return {
    pickupZone,
    dropoffZone,
    corridorId: corridor.id,
    corridorName: corridor.name,
    distanceKm: fareResult.distanceKm,
    passengerCount,
    perPersonFareBDT: fareResult.perPersonFareBDT,
    totalFareBDT: fareResult.totalFareBDT,
    discountPercentage: fareResult.discountPercentage,
    fareDetails: fareResult,
    breakdown: fareResult.breakdown ?? solo,
    poolOptions,
  };
}

export async function requestRide(passengerId: string, input: RequestRideInput) {
  const pickupZone = input.pickupZone as Zone;
  const destinationZone = (input.destinationZone || input.dropoffZone) as Zone;
  const seats = input.seats ?? input.passengerCount ?? 1;
  const openToShare = input.openToShare ?? false;
  const maxShareSeats = openToShare ? (input.maxShareSeats ?? 0) : 0;
  const seatsCap = Math.min(3, seats + maxShareSeats);

  const activeRide = await prisma.rideRequest.findFirst({
    where: {
      passengerId,
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'ARRIVED_AT_DESTINATION'] },
    },
  });

  if (activeRide) {
    throw new RideError(409, 'User already has an active ride in progress');
  }

  const matchingCorridors = findCorridorsForRoute(pickupZone, destinationZone);
  if (matchingCorridors.length === 0) {
    throw new RideError(
      400,
      `No straight-line corridor route available connecting ${pickupZone} to ${destinationZone}`
    );
  }

  const assignedCorridor = matchingCorridors[0];

  return prisma.$transaction(async (tx) => {
    const newPool = await tx.pool.create({
      data: {
        pickupZone,
        corridorId: assignedCorridor.id,
        shareable: openToShare,
        seatsCap,
        seatsTaken: 0,
        stage: 'REQUESTED',
      },
    });

    await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${newPool.id} FOR UPDATE`;

    const calculation = calculateCorridorPoolFares({
      corridor: assignedCorridor,
      pickupZone,
      riders: [
        {
          requestId: 'new_request',
          pickupZone,
          destinationZone,
          seats,
        },
      ],
    });

    const newRiderFare = calculation.riders['new_request'];
    const newRide = await tx.rideRequest.create({
      data: {
        passengerId,
        poolId: newPool.id,
        corridorId: assignedCorridor.id,
        pickupZone,
        destinationZone,
        seats,
        openToShare,
        maxShareSeats,
        stage: 'REQUESTED',
        paymentMethod: input.paymentMethod === 'CASH' ? 'CASH' : 'TESLAPAY',
        paymentStatus: 'PAID',
        paidAt: new Date(),
        ...farePersistFields(newRiderFare),
      },
      include: {
        pool: true,
      },
    });

    const finalBreakdown = { ...newRiderFare, requestId: newRide.id };
    await tx.rideRequest.update({
      where: { id: newRide.id },
      data: { fareBreakdown: finalBreakdown as object },
    });

    await tx.pool.update({
      where: { id: newPool.id },
      data: { seatsTaken: seats },
    });

    return {
      ...newRide,
      fareBreakdown: finalBreakdown,
      fareSummary: {
        totalFareBDT: newRiderFare.totalFareBDT,
        perPersonFareBDT: Math.round(newRiderFare.totalFareBDT / seats),
        sharedPortionBDT: newRiderFare.sharedPortionBDT,
        soloPortionBDT: newRiderFare.soloPortionBDT,
        totalDiscountBDT: newRiderFare.totalDiscountBDT,
        corridorId: assignedCorridor.id,
        corridorName: assignedCorridor.name,
      },
    };
  });
}

function farePersistFields(updatedFare: RiderFareBreakdown) {
  return {
    baseFarePaisa: 0,
    distanceChargePaisa: updatedFare.totalFarePaisa + updatedFare.totalDiscountPaisa,
    poolDiscountPaisa: updatedFare.totalDiscountPaisa,
    totalFarePaisa: updatedFare.totalFarePaisa,
    fareBreakdown: updatedFare as object,
  };
}

async function persistPoolFares(
  tx: Prisma.TransactionClient,
  corridor: Corridor,
  pickupZone: Zone,
  requests: Array<{ id: string; pickupZone: string; destinationZone: string; seats: number }>
) {
  const calculation = calculateCorridorPoolFares({
    corridor,
    pickupZone,
    riders: requests.map((r) => ({
      requestId: r.id,
      pickupZone: r.pickupZone as Zone,
      destinationZone: r.destinationZone as Zone,
      seats: r.seats,
    })),
  });

  for (const request of requests) {
    const updatedFare = calculation.riders[request.id];
    if (updatedFare) {
      await tx.rideRequest.update({
        where: { id: request.id },
        data: farePersistFields(updatedFare),
      });
    }
  }

  return calculation;
}

export async function listAvailableShares(passengerId: string, query: AvailableSharesQuery) {
  const pickupZone = query.pickupZone as Zone;
  const destinationZone = query.destinationZone as Zone;
  const seats = query.seats ?? 1;

  if (!findCorridorForRoute(pickupZone, destinationZone)) {
    throw new RideError(
      400,
      `No straight-line corridor route available connecting ${pickupZone} to ${destinationZone}`
    );
  }

  const solo = calculateSoloCorridorFare(pickupZone, destinationZone, seats);

  const candidates = await prisma.pool.findMany({
    where: {
      shareable: true,
      pickupZone,
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'] },
    },
    include: {
      rideRequests: {
        where: { stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'] } },
        select: {
          id: true,
          passengerId: true,
          pickupZone: true,
          destinationZone: true,
          seats: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const shares = [];

  for (const pool of candidates) {
    if (pool.seatsTaken >= pool.seatsCap) continue;

    const eligibility = evaluateShareCandidate(
      {
        id: pool.id,
        shareable: pool.shareable,
        pickupZone: pool.pickupZone,
        corridorId: pool.corridorId,
        stage: pool.stage,
        seatsTaken: pool.seatsTaken,
        seatsCap: pool.seatsCap,
        existingDestinations: pool.rideRequests.map((r) => r.destinationZone),
        memberPassengerIds: pool.rideRequests.map((r) => r.passengerId),
      },
      { pickupZone, destinationZone, seats, passengerId }
    );

    if (!eligibility.eligible || !eligibility.corridor) continue;

    const previewRiders = [
      ...pool.rideRequests.map((r) => ({
        requestId: r.id,
        pickupZone: r.pickupZone as Zone,
        destinationZone: r.destinationZone as Zone,
        seats: r.seats,
      })),
      {
        requestId: 'preview-join',
        pickupZone,
        destinationZone,
        seats,
      },
    ];

    const preview = calculateCorridorPoolFares({
      corridor: eligibility.corridor,
      pickupZone,
      riders: previewRiders,
    });

    const joinFare = preview.riders['preview-join'];
    const savingsPaisa = Math.max(0, solo.totalFarePaisa - joinFare.totalFarePaisa);

    shares.push({
      poolId: pool.id,
      pickupZone: pool.pickupZone,
      corridorId: eligibility.corridor.id,
      corridorName: eligibility.corridor.name,
      stage: pool.stage,
      seatsTaken: pool.seatsTaken,
      seatsCap: pool.seatsCap,
      seatsRemaining: eligibility.seatsRemaining,
      existingDropoffs: [...new Set(pool.rideRequests.map((r) => r.destinationZone))],
      soloFareBDT: solo.totalFareBDT,
      soloFarePaisa: solo.totalFarePaisa,
      estimatedJoinFareBDT: joinFare.totalFareBDT,
      estimatedJoinFarePaisa: joinFare.totalFarePaisa,
      savingsBDT: savingsPaisa / 100,
      savingsPaisa,
      breakdown: joinFare,
    });
  }

  shares.sort((a, b) => b.savingsPaisa - a.savingsPaisa || a.estimatedJoinFarePaisa - b.estimatedJoinFarePaisa);

  return {
    pickupZone,
    destinationZone,
    seats,
    soloFareBDT: solo.totalFareBDT,
    soloFarePaisa: solo.totalFarePaisa,
    shares,
  };
}

export async function joinPool(passengerId: string, poolId: string, input: JoinPoolInput) {
  const destinationZone = input.destinationZone as Zone;
  const seats = input.seats ?? 1;

  const activeRide = await prisma.rideRequest.findFirst({
    where: {
      passengerId,
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'ARRIVED_AT_DESTINATION'] },
    },
  });

  if (activeRide) {
    throw new RideError(409, 'User already has an active ride in progress');
  }

  const result = await prisma.$transaction(async (tx) => {
    let locked: {
      id: string;
      seatsCap: number;
      seatsTaken: number;
      corridorId: string | null;
      pickupZone: string;
      shareable: boolean;
      stage: string;
    } | undefined;

    try {
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          seatsCap: number;
          seatsTaken: number;
          corridorId: string | null;
          pickupZone: string;
          shareable: boolean;
          stage: string;
        }>
      >`SELECT id, "seatsCap", "seatsTaken", "corridorId", "pickupZone", shareable, stage
        FROM "Pool" WHERE id = ${poolId} FOR UPDATE`;
      locked = lockedRows?.[0];
    } catch {
      const p = await tx.pool.findUnique({
        where: { id: poolId },
        select: {
          id: true,
          seatsCap: true,
          seatsTaken: true,
          corridorId: true,
          pickupZone: true,
          shareable: true,
          stage: true,
        },
      });
      locked = p as any;
    }

    if (!locked) {
      throw new RideError(404, 'Ride not found');
    }

    if (locked.stage === 'STARTED' || locked.stage === 'COMPLETED' || locked.stage === 'ARRIVED_AT_DESTINATION') {
      throw new RideError(409, 'This ride has already started');
    }

    // Strict atomic concurrency check
    if (locked.seatsTaken + seats > locked.seatsCap) {
      throw new RideError(409, 'No available seats remaining in this pool', 'POOL_FULL');
    }

    const existingRequests = await tx.rideRequest.findMany({
      where: {
        poolId,
        stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS'] },
      },
    });

    const eligibility = evaluateShareCandidate(
      {
        id: locked.id,
        shareable: locked.shareable,
        pickupZone: locked.pickupZone,
        corridorId: locked.corridorId,
        stage: locked.stage,
        seatsTaken: locked.seatsTaken,
        seatsCap: locked.seatsCap,
        existingDestinations: existingRequests.map((r) => r.destinationZone),
        memberPassengerIds: existingRequests.map((r) => r.passengerId),
      },
      {
        pickupZone: locked.pickupZone as Zone,
        destinationZone,
        seats,
        passengerId,
      }
    );

    // corridor_incompatible is now allowed — only hard-reject shareable/stage/capacity/member failures.
    if (!eligibility.eligible && eligibility.reason !== 'corridor_incompatible') {
      if (eligibility.reason === 'no_capacity') {
        throw new RideError(409, 'No available seats remaining in this pool', 'POOL_FULL');
      }
      if (eligibility.reason === 'not_shareable') {
        throw new RideError(409, 'This ride is not open to share');
      }
      if (eligibility.reason === 'stage_closed') {
        throw new RideError(409, 'This ride has already started');
      }
      if (eligibility.reason === 'already_a_member') {
        throw new RideError(409, 'You are already on this ride');
      }
      throw new RideError(409, 'This ride cannot be joined');
    }

    const pickupZone = locked.pickupZone as Zone;

    // Try to find a common corridor covering ALL destinations (existing riders + new joiner).
    // If a common corridor exists: apply pooled leg-discount logic for everyone.
    // If not: the new joiner pays solo fare on their own route; existing riders are unchanged.
    const allDestinations = [
      ...existingRequests.map((r) => r.destinationZone as Zone),
      destinationZone,
    ];
    const commonCorridor = findCorridorForRiders(pickupZone, allDestinations);

    const newRequestCorridorId = commonCorridor?.id ?? locked.corridorId ?? null;

    const newRide = await tx.rideRequest.create({
      data: {
        passengerId,
        poolId,
        corridorId: newRequestCorridorId,
        pickupZone,
        destinationZone,
        seats,
        openToShare: false,
        maxShareSeats: 0,
        paymentMethod: input.paymentMethod === 'CASH' ? 'CASH' : 'TESLAPAY',
        paymentStatus: 'PAID',
        paidAt: new Date(),
        stage: locked.stage === 'REQUESTED' ? 'REQUESTED' : 'MATCHED',
        baseFarePaisa: 0,
        distanceChargePaisa: 0,
        poolDiscountPaisa: 0,
        totalFarePaisa: 0,
      },
    });

    const allRequests = [
      ...existingRequests.map((r) => ({
        id: r.id,
        pickupZone: r.pickupZone,
        destinationZone: r.destinationZone,
        seats: r.seats,
      })),
      { id: newRide.id, pickupZone, destinationZone, seats },
    ];

    let newRiderFare: RiderFareBreakdown;

    if (commonCorridor) {
      // All destinations share a corridor — pooled leg-discount applies to everyone
      const calculation = await persistPoolFares(tx, commonCorridor, pickupZone, allRequests);
      newRiderFare = calculation.riders[newRide.id];
    } else {
      // No common corridor — joiner pays solo fare; existing riders are left unchanged
      const joinerCorridor = findCorridorForRoute(pickupZone, destinationZone);
      if (!joinerCorridor) {
        throw new RideError(400, `No route available from ${pickupZone} to ${destinationZone}`);
      }
      const soloCalc = calculateCorridorPoolFares({
        corridor: joinerCorridor,
        pickupZone,
        riders: [{ requestId: newRide.id, pickupZone, destinationZone, seats }],
      });
      newRiderFare = soloCalc.riders[newRide.id];
      await tx.rideRequest.update({
        where: { id: newRide.id },
        data: farePersistFields(newRiderFare),
      });
    }

    // BUGFIX NOTE (Change 3): joinPool must NEVER modify Pool.teslaId, Pool.stage,
    // or any other driver-assignment fields. Touching teslaId or resetting stage to
    // REQUESTED would cause a MATCHED pool to reappear in the driver's open-pools feed,
    // requiring the driver to re-accept what they already accepted. Only seatsTaken
    // (and optionally corridorId when a common corridor is found) may be updated here.
    await tx.pool.update({
      where: { id: poolId },
      data: {
        seatsTaken: locked.seatsTaken + seats,
        ...(commonCorridor ? { corridorId: commonCorridor.id } : {}),
      },
    });

    const updatedRide = await tx.rideRequest.findUniqueOrThrow({
      where: { id: newRide.id },
      include: { pool: true },
    });

    return {
      ...updatedRide,
      fareBreakdown: newRiderFare,
      fareSummary: {
        totalFareBDT: newRiderFare.totalFareBDT,
        perPersonFareBDT: Math.round(newRiderFare.totalFareBDT / seats),
        sharedPortionBDT: newRiderFare.sharedPortionBDT,
        soloPortionBDT: newRiderFare.soloPortionBDT,
        totalDiscountBDT: newRiderFare.totalDiscountBDT,
        corridorId: newRiderFare.corridorId,
        corridorName: newRiderFare.corridorName,
      },
    };
  });

  // Notify driver if the pool already has a tesla assigned
  if (result.pool?.teslaId) {
    const [tesla, passenger, updatedPool] = await Promise.all([
      prisma.tesla.findUnique({
        where: { id: result.pool.teslaId },
        select: { driverId: true },
      }),
      prisma.user.findUnique({
        where: { id: passengerId },
        select: { name: true },
      }),
      prisma.pool.findUnique({
        where: { id: poolId },
        select: { pickupZone: true, seatsTaken: true },
      }),
    ]);
    if (tesla?.driverId) {
      const passengerName = passenger?.name || 'A passenger';
      const pickup = updatedPool?.pickupZone || result.pickupZone;
      const destination = result.destinationZone;
      const seatsNow = updatedPool?.seatsTaken || 1;
      await createNotification({
        userId: tesla.driverId,
        type: 'RIDER_JOINED',
        message: `${passengerName} joined your ${pickup}->${destination} ride — ${seatsNow} seat(s) now taken.`,
        rideRequestId: result.id,
        poolId: poolId,
      });
    }
  }

  return result;
}

/**
 * Lists all shareable, joinable pools system-wide (no route-collision filtering).
 * Optionally filters by a case-insensitive search string matching pickupZone or
 * any current rider's destinationZone.
 */
export async function listShareableRides(search?: string) {
  const pools = await prisma.pool.findMany({
    where: {
      shareable: true,
      stage: { in: ['REQUESTED', 'MATCHED'] },
      ...(search
        ? {
            OR: [
              { pickupZone: { contains: search, mode: 'insensitive' } },
              {
                rideRequests: {
                  some: {
                    destinationZone: { contains: search, mode: 'insensitive' },
                    stage: { notIn: ['CANCELLED'] },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      rideRequests: {
        where: { stage: { notIn: ['CANCELLED'] } },
        select: {
          destinationZone: true,
          seats: true,
          passenger: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter in-memory: seatsTaken < seatsCap (Prisma can't compare two fields directly)
  return pools
    .filter((p) => p.seatsTaken < p.seatsCap)
    .map((p) => ({
      poolId: p.id,
      pickupZone: p.pickupZone,
      stage: p.stage,
      seatsTaken: p.seatsTaken,
      seatsCap: p.seatsCap,
      seatsAvailable: p.seatsCap - p.seatsTaken,
      riders: p.rideRequests.map((r) => ({
        destinationZone: r.destinationZone,
        seats: r.seats,
        passenger: r.passenger,
      })),
    }));
}

/**
 * Cancels a ride request, freeing pool seats and recomputing fares
 * for all remaining members inside a locked transaction.
 */
export async function cancelRide(passengerId: string, rideRequestId: string) {
  return prisma.$transaction(async (tx) => {
    const ride = await tx.rideRequest.findUnique({
      where: { id: rideRequestId },
      include: { pool: true },
    });

    if (!ride) {
      throw new RideError(404, 'Ride request not found');
    }

    if (ride.passengerId !== passengerId) {
      throw new RideError(403, 'Unauthorized to cancel this ride');
    }

    if (ride.stage === 'CANCELLED') {
      throw new RideError(400, 'Ride is already cancelled');
    }

    if (['STARTED', 'COMPLETED'].includes(ride.stage)) {
      throw new RideError(400, `Cannot cancel a ride that is ${ride.stage.toLowerCase()}`);
    }

    // Cancel the ride request
    const updatedRide = await tx.rideRequest.update({
      where: { id: rideRequestId },
      data: {
        stage: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    if (!ride.poolId) {
      return updatedRide;
    }

    // Lock the pool row
    const [lockedPool] = await tx.$queryRaw<
      Array<{ id: string; seatsCap: number; seatsTaken: number; corridorId: string | null }>
    >`SELECT id, "seatsCap", "seatsTaken", "corridorId" FROM "Pool" WHERE id = ${ride.poolId} FOR UPDATE`;

    if (!lockedPool) {
      return updatedRide;
    }

    // Fetch remaining active requests in the pool
    const remainingRequests = await tx.rideRequest.findMany({
      where: {
        poolId: ride.poolId,
        id: { not: rideRequestId },
        stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'] },
      },
    });

    const newSeatsTaken = remainingRequests.reduce((sum, r) => sum + r.seats, 0);

    if (remainingRequests.length === 0) {
      // No more riders in this pool -> mark pool as CANCELLED
      await tx.pool.update({
        where: { id: ride.poolId },
        data: {
          seatsTaken: 0,
          stage: 'CANCELLED',
        },
      });
      return updatedRide;
    }

    // Update pool seatsTaken
    await tx.pool.update({
      where: { id: ride.poolId },
      data: { seatsTaken: newSeatsTaken },
    });

    // Recompute fares for remaining pool members
    const corridor = lockedPool.corridorId ? findCorridorById(lockedPool.corridorId) : null;
    if (corridor) {
      await persistPoolFares(
        tx,
        corridor,
        ride.pickupZone as Zone,
        remainingRequests.map((r) => ({
          id: r.id,
          pickupZone: r.pickupZone,
          destinationZone: r.destinationZone,
          seats: r.seats,
        }))
      );
    }

    return updatedRide;
  });
}

export async function getMyRides(passengerId: string) {
  return prisma.rideRequest.findMany({
    where: { passengerId },
    orderBy: { createdAt: 'desc' },
    include: {
      review: true,
      pool: {
        include: {
          tesla: {
            include: {
              driver: {
                select: { id: true, name: true },
              },
            },
          },
          rideRequests: {
            where: { stage: { notIn: ['CANCELLED'] } },
            select: {
              id: true,
              passengerId: true,
              destinationZone: true,
              seats: true,
              passenger: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function getActiveRides() {
  const activePools = await prisma.pool.findMany({
    where: {
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'ARRIVED_AT_DESTINATION'] },
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
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'ARRIVED_AT_DESTINATION'] },
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

export async function getPassengerHistory(passengerId: string) {
  const [rides, aggregate] = await Promise.all([
    prisma.rideRequest.findMany({
      where: { passengerId },
      orderBy: { createdAt: 'desc' },
      include: {
        pool: {
          include: {
            tesla: {
              include: {
                driver: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.rideRequest.aggregate({
      where: { passengerId, stage: 'COMPLETED' },
      _sum: { totalFarePaisa: true },
      _count: true,
    }),
  ]);

  const formattedRides = rides.map((r) => ({
    id: r.id,
    pickupZone: r.pickupZone,
    destinationZone: r.destinationZone,
    createdAt: r.createdAt,
    stage: r.stage,
    totalFarePaisa: r.totalFarePaisa,
    driverName: r.pool?.tesla?.driver?.name ?? null,
  }));

  const completedRideCount = aggregate._count ?? 0;

  return {
    rides: formattedRides,
    totalSpentPaisa: aggregate._sum?.totalFarePaisa ?? 0,
    completedRideCount,
  };
}

export async function markArrivedAtDestination(driverId: string, poolOrRideId: string) {
  let pool = await prisma.pool.findUnique({
    where: { id: poolOrRideId },
    include: {
      tesla: true,
      rideRequests: {
        include: { passenger: { select: { id: true, name: true } } },
      },
    },
  });

  if (!pool) {
    const ride = await prisma.rideRequest.findUnique({
      where: { id: poolOrRideId },
      include: {
        pool: {
          include: {
            tesla: true,
            rideRequests: {
              include: { passenger: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (ride?.pool) {
      pool = ride.pool as any;
    }
  }

  if (!pool) throw new RideError(404, 'Pool or ride not found');

  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla || pool.teslaId !== tesla.id) {
    throw new RideError(403, 'This ride is not assigned to your Tesla');
  }

  const [updatedPool] = await prisma.$transaction([
    prisma.pool.update({
      where: { id: pool.id },
      data: {
        stage: 'ARRIVED_AT_DESTINATION',
        arrivedAt: pool.arrivedAt ?? new Date(),
      },
      include: {
        rideRequests: {
          include: { passenger: { select: { id: true, name: true } } },
        },
        tesla: true,
      },
    }),
    prisma.rideRequest.updateMany({
      where: { poolId: pool.id, stage: { notIn: ['CANCELLED', 'COMPLETED'] } },
      data: { stage: 'ARRIVED_AT_DESTINATION' },
    }),
  ]);

  return updatedPool;
}

export async function payRide(
  passengerId: string,
  rideId: string,
  method: 'TESLAPAY' | 'CASH'
) {
  const ride = await prisma.rideRequest.findUnique({
    where: { id: rideId },
    include: { pool: { include: { tesla: { include: { driver: true } } } } },
  });

  if (!ride) throw new RideError(404, 'Ride request not found');
  if (ride.passengerId !== passengerId) throw new RideError(403, 'Not your ride');
  if (ride.paymentStatus === 'PAID') return ride;
  if (ride.paymentStatus === 'PENDING_CONFIRMATION') {
    throw new RideError(400, 'Payment already submitted, awaiting driver confirmation');
  }
  const payableStages = ['DRIVER_ARRIVED', 'IN_PROGRESS', 'ARRIVED_AT_DESTINATION', 'COMPLETED'];
  if (!payableStages.includes(ride.stage)) {
    throw new RideError(400, 'Ride is not in a payable stage yet');
  }

  if (method === 'TESLAPAY') {
    const driverId = ride.pool?.tesla?.driverId;
    if (!driverId) throw new RideError(404, 'No Tesla/driver assigned to this ride');
    const amount = ride.totalFarePaisa;

    const res = await prisma.$transaction(async (tx) => {
      // Lock both users in consistent order to prevent deadlocks
      const ids = [passengerId, driverId].sort();
      await tx.$queryRaw`SELECT id FROM "User" WHERE id IN (${ids[0]}, ${ids[1]}) ORDER BY id FOR UPDATE`;

      const passenger = await tx.user.findUnique({
        where: { id: passengerId },
        select: { id: true, name: true, teslaPayBalancePaisa: true },
      });
      if (!passenger || passenger.teslaPayBalancePaisa < amount) {
        throw new RideError(409, 'Insufficient TeslaPay balance');
      }

      const updatedPassenger = await tx.user.update({
        where: { id: passengerId },
        data: { teslaPayBalancePaisa: { decrement: amount } },
        select: { teslaPayBalancePaisa: true },
      });
      await tx.user.update({
        where: { id: driverId },
        data: { teslaPayBalancePaisa: { increment: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          userId: passengerId,
          amountPaisa: -amount,
          type: 'RIDE_PAYMENT_DEBIT',
          rideRequestId: rideId,
        },
      });
      await tx.walletTransaction.create({
        data: {
          userId: driverId,
          amountPaisa: amount,
          type: 'RIDE_PAYMENT_CREDIT',
          rideRequestId: rideId,
        },
      });

      const updated = await tx.rideRequest.update({
        where: { id: rideId },
        data: { paymentMethod: 'TESLAPAY', paymentStatus: 'PAID', paidAt: new Date() },
      });

      return {
        passengerName: passenger.name,
        updatedPassenger,
        updated,
      };
    });

    // Create Notification for the driver: "{passenger name} paid ৳X via TeslaPay for the {pickup}->{destination} ride."
    const fareBDT = Math.round(amount / 100);
    await createNotification({
      userId: driverId,
      type: 'PAYMENT_CONFIRMED',
      message: `${res.passengerName} paid ৳${fareBDT} via TeslaPay for the ${ride.pickupZone}->${ride.destinationZone} ride.`,
      rideRequestId: rideId,
      poolId: ride.poolId ?? undefined,
    });

    return {
      success: true,
      method: 'TESLAPAY' as const,
      balancePaisa: res.updatedPassenger.teslaPayBalancePaisa,
      ride: res.updated,
    };
  } else {
    // CASH: set to PENDING_CONFIRMATION, driver must confirm
    const updated = await prisma.rideRequest.update({
      where: { id: rideId },
      data: { paymentMethod: 'CASH', paymentStatus: 'PENDING_CONFIRMATION' },
      include: { passenger: { select: { name: true } } },
    });

    // Notify driver: "{passenger name} says they paid ৳X cash for the {pickup}->{destination} ride — please confirm you received it."
    const driverId = ride.pool?.tesla?.driverId;
    if (driverId) {
      const passengerName = updated.passenger?.name || 'A passenger';
      const fareBDT = Math.round(ride.totalFarePaisa / 100);
      await createNotification({
        userId: driverId,
        type: 'CASH_PAYMENT_MARKED',
        message: `${passengerName} says they paid ৳${fareBDT} cash for the ${ride.pickupZone}->${ride.destinationZone} ride — please confirm you received it.`,
        rideRequestId: rideId,
        poolId: ride.poolId ?? undefined,
      });
    }

    return {
      success: true,
      method: 'CASH' as const,
      status: 'PENDING_CONFIRMATION' as const,
      ride: updated,
    };
  }
}


export async function completeRideWithPaymentCheck(driverId: string, poolOrRideId: string) {
  let pool = await prisma.pool.findUnique({
    where: { id: poolOrRideId },
    include: {
      tesla: true,
      rideRequests: {
        include: { passenger: { select: { id: true, name: true } } },
      },
    },
  });

  if (!pool) {
    const ride = await prisma.rideRequest.findUnique({
      where: { id: poolOrRideId },
      include: {
        pool: {
          include: {
            tesla: true,
            rideRequests: {
              include: { passenger: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (ride?.pool) {
      pool = ride.pool as any;
    }
  }

  if (!pool) throw new RideError(404, 'Pool or ride not found');

  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) throw new RideError(403, 'No Tesla registered for this driver');
  if (pool.teslaId && pool.teslaId !== tesla.id) {
    throw new RideError(403, 'This ride is not assigned to your Tesla');
  }

  const [updatedPool] = await prisma.$transaction([
    prisma.pool.update({
      where: { id: pool.id },
      data: {
        stage: 'COMPLETED',
        completedAt: new Date(),
        teslaId: pool.teslaId ?? tesla.id,
      },
      include: {
        rideRequests: {
          include: { passenger: { select: { id: true, name: true } } },
        },
        tesla: true,
      },
    }),
    prisma.rideRequest.updateMany({
      where: { poolId: pool.id, stage: { notIn: ['CANCELLED'] } },
      data: { stage: 'COMPLETED', paymentStatus: 'PAID' },
    }),
  ]);

  return updatedPool;
}

export async function leaveRide(passengerId: string, rideId: string) {
  const ride = await prisma.rideRequest.findUnique({
    where: { id: rideId },
    include: {
      pool: {
        include: {
          tesla: { include: { driver: true } },
          rideRequests: true,
        },
      },
      passenger: true,
    },
  });

  if (!ride) throw new RideError(404, 'Ride request not found');
  if (ride.passengerId !== passengerId) throw new RideError(403, 'Not your ride');
  if (ride.stage === 'CANCELLED') throw new RideError(400, 'Ride is cancelled');

  const updatedRide = await prisma.rideRequest.update({
    where: { id: rideId },
    data: {
      stage: 'COMPLETED',
      paymentStatus: 'PAID',
      paidAt: ride.paidAt ?? new Date(),
    },
  });

  const driverId = ride.pool?.tesla?.driverId;
  const passengerName = ride.passenger?.name || 'Passenger';
  if (driverId) {
    await createNotification({
      userId: driverId,
      type: 'PAYMENT_CONFIRMED',
      message: `${passengerName} has left the vehicle at ${ride.destinationZone}. Journey ended.`,
      rideRequestId: rideId,
      poolId: ride.poolId ?? undefined,
    }).catch(() => {});
  }

  let poolCompleted = false;
  if (ride.poolId && ride.pool) {
    const remainingActive = ride.pool.rideRequests.filter(
      (r) => r.id !== rideId && r.stage !== 'CANCELLED' && r.stage !== 'COMPLETED'
    );

    if (remainingActive.length === 0) {
      await prisma.pool.update({
        where: { id: ride.poolId },
        data: {
          stage: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      poolCompleted = true;

      if (driverId) {
        await createNotification({
          userId: driverId,
          type: 'PAYMENT_CONFIRMED',
          message: 'All passengers have ended their journey! Trip is now completed.',
          poolId: ride.poolId,
        }).catch(() => {});
      }
    }
  }

  return {
    success: true,
    ride: updatedRide,
    poolCompleted,
  };
}