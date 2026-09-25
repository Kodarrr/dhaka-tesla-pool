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

//  simple ride error handling

export class RideError extends Error {
  constructor(public statusCode: number, message: string) {
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
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'] },
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
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'] },
    },
  });

  if (activeRide) {
    throw new RideError(409, 'User already has an active ride in progress');
  }

  return prisma.$transaction(async (tx) => {
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

    const locked = lockedRows[0];
    if (!locked) {
      throw new RideError(404, 'Ride not found');
    }

    if (locked.stage === 'STARTED' || locked.stage === 'COMPLETED') {
      throw new RideError(409, 'This ride has already started');
    }

    const existingRequests = await tx.rideRequest.findMany({
      where: {
        poolId,
        stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'] },
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
      if (eligibility.reason === 'not_shareable') {
        throw new RideError(409, 'This ride is not open to share');
      }
      if (eligibility.reason === 'stage_closed') {
        throw new RideError(409, 'This ride has already started');
      }
      if (eligibility.reason === 'no_capacity') {
        throw new RideError(409, 'Not enough seats remaining on this ride');
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
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'] },
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
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'] },
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