import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  calculateFare,
  calculateCorridorPoolFares,
  calculateSoloCorridorFare,
  RiderFareBreakdown,
  PER_KM_RATE_BDT,
  POOL_DISCOUNT_PCT,
} from '../../config/fare.js';
import {
  Zone,
  Corridor,
  findCorridorsForRoute,
  findCorridorForRoute,
  findCorridorById,
  findCorridorForRiders,
  getDistance,
  canJoinPoolRoute,
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

  if (pickupZone === dropoffZone) {
    throw new RideError(400, 'Pickup and destination cannot be the same zone');
  }

  const corridor = findCorridorForRoute(pickupZone, dropoffZone);
  const fareResult = calculateFare(pickupZone, dropoffZone, passengerCount);

  let solo: RiderFareBreakdown | undefined;
  if (corridor) {
    try {
      solo = calculateSoloCorridorFare(pickupZone, dropoffZone, passengerCount);
    } catch {
      // fallback
    }
  }

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

  const fallbackBreakdown: RiderFareBreakdown = {
    requestId: 'estimate',
    pickupZone,
    destinationZone: dropoffZone,
    corridorId: corridor?.id ?? 'CITY_ROUTE',
    corridorName: corridor?.name ?? `${pickupZone} → ${dropoffZone}`,
    seats: passengerCount,
    legs: [
      {
        legIndex: 0,
        fromZone: pickupZone,
        toZone: dropoffZone,
        distanceKm: fareResult.distanceKm,
        baseFareBDT: fareResult.rawFareBDT,
        riderCount: passengerCount,
        discountPct: fareResult.discountPercentage,
        riderFareBDT: fareResult.totalFareBDT,
        riderFarePaisa: fareResult.totalFarePaisa,
      },
    ],
    sharedLegsCount: passengerCount > 1 ? 1 : 0,
    soloLegsCount: passengerCount > 1 ? 0 : 1,
    sharedPortionBDT: passengerCount > 1 ? fareResult.totalFareBDT : 0,
    soloPortionBDT: passengerCount > 1 ? 0 : fareResult.totalFareBDT,
    sharedPortionPaisa: (passengerCount > 1 ? fareResult.totalFareBDT : 0) * 100,
    soloPortionPaisa: (passengerCount > 1 ? 0 : fareResult.totalFareBDT) * 100,
    totalDiscountBDT: Math.round(fareResult.poolDiscountPaisa / 100),
    totalDiscountPaisa: fareResult.poolDiscountPaisa,
    totalFareBDT: fareResult.totalFareBDT,
    totalFarePaisa: fareResult.totalFarePaisa,
  };

  return {
    pickupZone,
    dropoffZone,
    corridorId: corridor?.id ?? null,
    corridorName: corridor?.name ?? `${pickupZone} → ${dropoffZone}`,
    distanceKm: fareResult.distanceKm,
    passengerCount,
    perPersonFareBDT: fareResult.perPersonFareBDT,
    totalFareBDT: fareResult.totalFareBDT,
    discountPercentage: fareResult.discountPercentage,
    fareDetails: fareResult,
    breakdown: fareResult.breakdown ?? solo ?? fallbackBreakdown,
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

  if (pickupZone === destinationZone) {
    throw new RideError(400, 'Pickup and destination cannot be the same zone');
  }

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
  const assignedCorridor = matchingCorridors[0] ?? null;

  return prisma.$transaction(async (tx) => {
    const newPool = await tx.pool.create({
      data: {
        pickupZone,
        currentLocation: pickupZone,
        corridorId: assignedCorridor?.id ?? null,
        shareable: openToShare,
        seatsCap,
        seatsTaken: 0,
        stage: 'REQUESTED',
      },
    });

    await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${newPool.id} FOR UPDATE`;

    let newRiderFare: RiderFareBreakdown;

    if (assignedCorridor) {
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
      newRiderFare = calculation.riders['new_request'];
    } else {
      const fare = calculateFare(pickupZone, destinationZone, seats);
      newRiderFare = {
        requestId: 'new_request',
        pickupZone,
        destinationZone,
        corridorId: 'CITY_ROUTE',
        corridorName: `${pickupZone} → ${destinationZone}`,
        seats,
        legs: [
          {
            legIndex: 0,
            fromZone: pickupZone,
            toZone: destinationZone,
            distanceKm: fare.distanceKm,
            baseFareBDT: fare.rawFareBDT,
            riderCount: 1,
            discountPct: 0,
            riderFareBDT: fare.totalFareBDT,
            riderFarePaisa: fare.totalFarePaisa,
          },
        ],
        sharedLegsCount: 0,
        soloLegsCount: 1,
        sharedPortionBDT: 0,
        soloPortionBDT: fare.totalFareBDT,
        sharedPortionPaisa: 0,
        soloPortionPaisa: fare.totalFarePaisa,
        totalDiscountBDT: 0,
        totalDiscountPaisa: 0,
        totalFareBDT: fare.totalFareBDT,
        totalFarePaisa: fare.totalFarePaisa,
      };
    }

    const newRide = await tx.rideRequest.create({
      data: {
        passengerId,
        poolId: newPool.id,
        corridorId: assignedCorridor?.id ?? null,
        pickupZone,
        destinationZone,
        seats,
        openToShare,
        maxShareSeats,
        stage: 'REQUESTED',
        paymentMethod: input.paymentMethod === 'CASH' ? 'CASH' : 'TESLAPAY',
        paymentStatus: 'UNPAID',
        paidAt: null,
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
        corridorId: assignedCorridor?.id ?? null,
        corridorName: assignedCorridor?.name ?? `${pickupZone} → ${destinationZone}`,
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
      currentLocation: string | null;
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
          currentLocation: string | null;
          shareable: boolean;
          stage: string;
        }>
      >`SELECT id, "seatsCap", "seatsTaken", "corridorId", "pickupZone", "currentLocation", shareable, stage
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
          currentLocation: true,
          shareable: true,
          stage: true,
        },
      });
      locked = p as any;
    }

    if (!locked) {
      throw new RideError(404, 'Ride not found');
    }

    if (locked.stage === 'ARRIVED_AT_DESTINATION' || locked.stage === 'COMPLETED' || locked.stage === 'CANCELLED') {
      throw new RideError(409, 'This ride cannot be joined as it is finishing or completed');
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

    if (existingRequests.some((r) => r.passengerId === passengerId)) {
      throw new RideError(409, 'You are already on this ride');
    }

    // Determine pickup zone: input source takes precedence, then pool currentLocation, then pool pickupZone
    const joinerPickup = (input.pickupZone || input.sourceZone || locked.currentLocation || locked.pickupZone) as Zone;

    if (joinerPickup === destinationZone) {
      throw new RideError(400, 'Pickup and destination cannot be the same zone');
    }

    // Direction validation: reject reverse-direction or incompatible routes
    const directionCheck = canJoinPoolRoute(
      {
        corridorId: locked.corridorId,
        pickupZone: locked.pickupZone as Zone,
        currentLocation: locked.currentLocation,
        activeRiders: existingRequests.map((r) => ({
          pickupZone: r.pickupZone,
          destinationZone: r.destinationZone,
        })),
      },
      joinerPickup,
      destinationZone
    );

    if (!directionCheck.canJoin) {
      throw new RideError(
        400,
        directionCheck.reason || 'Cannot join ride: route is in an incompatible or reverse direction'
      );
    }

    if (directionCheck.corridor && !locked.corridorId) {
      await tx.pool.update({
        where: { id: poolId },
        data: { corridorId: directionCheck.corridor.id },
      });
      locked.corridorId = directionCheck.corridor.id;
    }

    // Fare calculation: "only that part will be the fare will be shared"
    const distanceKm = getDistance(joinerPickup, destinationZone);
    const soloFareBDT = distanceKm * PER_KM_RATE_BDT;
    const discountMultiplier = 1 - POOL_DISCOUNT_PCT; // 30% discount
    const perPersonFareBDT = Math.round(soloFareBDT * discountMultiplier);
    const totalFareBDT = perPersonFareBDT * seats;
    const totalFarePaisa = totalFareBDT * 100;
    const discountAmountBDT = (soloFareBDT * seats) - totalFareBDT;
    const poolDiscountPaisa = discountAmountBDT * 100;
    const distanceChargePaisa = soloFareBDT * seats * 100;

    const newRiderFare: RiderFareBreakdown = {
      requestId: 'new_request',
      pickupZone: joinerPickup,
      destinationZone,
      corridorId: locked.corridorId ?? 'SHARED_POOL',
      corridorName: `${joinerPickup} → ${destinationZone}`,
      seats,
      legs: [
        {
          legIndex: 0,
          fromZone: joinerPickup,
          toZone: destinationZone,
          distanceKm,
          baseFareBDT: soloFareBDT * seats,
          riderCount: 2,
          discountPct: 30,
          riderFareBDT: totalFareBDT,
          riderFarePaisa: totalFarePaisa,
        },
      ],
      sharedLegsCount: 1,
      soloLegsCount: 0,
      sharedPortionBDT: totalFareBDT,
      soloPortionBDT: 0,
      sharedPortionPaisa: totalFarePaisa,
      soloPortionPaisa: 0,
      totalDiscountBDT: discountAmountBDT,
      totalDiscountPaisa: poolDiscountPaisa,
      totalFareBDT,
      totalFarePaisa,
    };

    const newRide = await tx.rideRequest.create({
      data: {
        passengerId,
        poolId,
        corridorId: locked.corridorId ?? null,
        pickupZone: joinerPickup,
        destinationZone,
        seats,
        openToShare: false,
        maxShareSeats: 0,
        paymentMethod: input.paymentMethod === 'CASH' ? 'CASH' : 'TESLAPAY',
        paymentStatus: 'UNPAID',
        paidAt: null,
        stage: locked.stage === 'REQUESTED' ? 'REQUESTED' : locked.stage === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'MATCHED',
        baseFarePaisa: 0,
        distanceChargePaisa,
        poolDiscountPaisa,
        totalFarePaisa,
        fareBreakdown: newRiderFare as object,
      },
    });

    await tx.pool.update({
      where: { id: poolId },
      data: {
        seatsTaken: locked.seatsTaken + seats,
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
      stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS'] },
      ...(search
        ? {
            OR: [
              { pickupZone: { contains: search, mode: 'insensitive' } },
              { currentLocation: { contains: search, mode: 'insensitive' } },
              {
                rideRequests: {
                  some: {
                    destinationZone: { contains: search, mode: 'insensitive' },
                    stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS'] },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      rideRequests: {
        where: { stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS'] } },
        select: {
          pickupZone: true,
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
    .map((p) => {
      let corridor = p.corridorId ? findCorridorById(p.corridorId) : undefined;
      if (!corridor && p.rideRequests.length > 0) {
        const dZone = p.rideRequests[0].destinationZone as Zone;
        corridor = findCorridorForRoute(p.pickupZone as Zone, dZone) ?? undefined;
      }

      return {
        poolId: p.id,
        pickupZone: p.pickupZone,
        currentLocation: p.currentLocation || p.pickupZone,
        corridorId: corridor?.id ?? p.corridorId ?? null,
        corridorName: corridor?.name ?? null,
        corridorZones: corridor?.zones ? Array.from(corridor.zones) : null,
        stage: p.stage,
        seatsTaken: p.seatsTaken,
        seatsCap: p.seatsCap,
        seatsAvailable: p.seatsCap - p.seatsTaken,
        riders: p.rideRequests.map((r) => ({
          pickupZone: r.pickupZone,
          destinationZone: r.destinationZone,
          seats: r.seats,
          passenger: r.passenger,
        })),
      };
    });
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

    // A passenger can only cancel if no driver has accepted the ride yet
    const hasDriverAccepted =
      ride.stage !== 'REQUESTED' ||
      (ride.pool && (ride.pool.stage !== 'REQUESTED' || ride.pool.teslaId !== null));

    if (hasDriverAccepted) {
      throw new RideError(
        400,
        'Cannot cancel ride: A driver has already accepted your ride. Cancellations are only allowed before a driver accepts.'
      );
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
      await tx.rideRequest.delete({ where: { id: rideRequestId } });
      return { id: rideRequestId, stage: 'CANCELLED', deleted: true };
    }

    // Lock the pool row
    const [lockedPool] = await tx.$queryRaw<
      Array<{ id: string; seatsCap: number; seatsTaken: number; corridorId: string | null }>
    >`SELECT id, "seatsCap", "seatsTaken", "corridorId" FROM "Pool" WHERE id = ${ride.poolId} FOR UPDATE`;

    // Fetch remaining active requests in the pool excluding the current one
    const remainingRequests = await tx.rideRequest.findMany({
      where: {
        poolId: ride.poolId,
        id: { not: rideRequestId },
        stage: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'ARRIVED_AT_DESTINATION'] },
      },
    });

    if (remainingRequests.length === 0) {
      // Both users or the only user cancelled the ride -> delete for both user end
      await tx.rideRequest.deleteMany({
        where: { poolId: ride.poolId },
      });
      await tx.pool.delete({
        where: { id: ride.poolId },
      });
      return { id: rideRequestId, stage: 'CANCELLED', deleted: true, poolDeleted: true };
    }

    // Other rider(s) still remain in this pool:
    // Delete the cancelling user's ride request so:
    // 1) It is deleted on the cancelling user's end
    // 2) The pool does not contain the cancelled user's name
    await tx.rideRequest.delete({
      where: { id: rideRequestId },
    });

    const newSeatsTaken = remainingRequests.reduce((sum, r) => sum + r.seats, 0);

    // Update pool seatsTaken
    await tx.pool.update({
      where: { id: ride.poolId },
      data: { seatsTaken: newSeatsTaken },
    });

    // Recompute / adjust fares for remaining pool members safely:
    try {
      if (remainingRequests.length === 1) {
        // Only 1 rider left: reverts to solo fare (0 pool discount)
        const sole = remainingRequests[0];
        const distKm = getDistance(sole.pickupZone as Zone, sole.destinationZone as Zone);
        const soloFareBDT = distKm * PER_KM_RATE_BDT * sole.seats;
        const soloFarePaisa = soloFareBDT * 100;
        await tx.rideRequest.update({
          where: { id: sole.id },
          data: {
            poolDiscountPaisa: 0,
            distanceChargePaisa: soloFarePaisa,
            totalFarePaisa: soloFarePaisa,
          },
        });
      } else if (remainingRequests.length > 1) {
        // Multiple riders remaining: if all share the same pickup, recompute corridor pooling
        const corridor = lockedPool?.corridorId ? findCorridorById(lockedPool.corridorId) : null;
        const firstPickup = remainingRequests[0].pickupZone as Zone;
        const allSamePickup = remainingRequests.every((r) => r.pickupZone === firstPickup);

        if (corridor && allSamePickup) {
          await persistPoolFares(
            tx,
            corridor,
            firstPickup,
            remainingRequests.map((r) => ({
              id: r.id,
              pickupZone: r.pickupZone,
              destinationZone: r.destinationZone,
              seats: r.seats,
            }))
          );
        }
      }
    } catch {
      // Safe fallback: fare recalculation error must never block ride cancellation
    }

    return { id: rideRequestId, stage: 'CANCELLED', deleted: true, poolDeleted: false };
  });
}

export async function getMyRides(passengerId: string) {
  return prisma.rideRequest.findMany({
    where: {
      passengerId,
      stage: { not: 'CANCELLED' },
    },
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
        where: { stage: { not: 'CANCELLED' } },
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
      tesla: {
        include: {
          driver: {
            select: { id: true, name: true },
          },
        },
      },
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

export async function leaveRide(
  passengerId: string,
  rideId: string,
  paymentMethod?: 'TESLAPAY' | 'CASH'
) {
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
  if (ride.stage === 'COMPLETED') throw new RideError(400, 'Ride is already completed');

  const chosenMethod = paymentMethod || (ride.paymentMethod === 'CASH' ? 'CASH' : 'TESLAPAY');
  const amount = ride.totalFarePaisa;
  const driverId = ride.pool?.tesla?.driverId;

  let updatedRide;

  if (chosenMethod === 'TESLAPAY') {
    const passenger = await prisma.user.findUnique({
      where: { id: passengerId },
      select: { id: true, name: true, teslaPayBalancePaisa: true },
    });
    if (!passenger || passenger.teslaPayBalancePaisa < amount) {
      const avail = Math.round((passenger?.teslaPayBalancePaisa ?? 0) / 100);
      const req = Math.round(amount / 100);
      throw new RideError(
        402,
        `Insufficient TeslaPay balance (৳${avail} available, ৳${req} required). Please top up or pay with cash.`
      );
    }

    updatedRide = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: passengerId },
        data: { teslaPayBalancePaisa: { decrement: amount } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: passengerId,
          amountPaisa: -amount,
          type: 'RIDE_PAYMENT_DEBIT',
          rideRequestId: rideId,
        },
      });

      if (driverId) {
        await tx.user.update({
          where: { id: driverId },
          data: { teslaPayBalancePaisa: { increment: amount } },
        });
        await tx.walletTransaction.create({
          data: {
            userId: driverId,
            amountPaisa: amount,
            type: 'RIDE_PAYMENT_CREDIT',
            rideRequestId: rideId,
          },
        });
      }

      return tx.rideRequest.update({
        where: { id: rideId },
        data: {
          stage: 'COMPLETED',
          paymentMethod: 'TESLAPAY',
          paymentStatus: 'PAID',
          paidAt: new Date(),
        },
      });
    });
  } else {
    // CASH payment at exit
    updatedRide = await prisma.rideRequest.update({
      where: { id: rideId },
      data: {
        stage: 'COMPLETED',
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        paidAt: new Date(),
      },
    });
  }

  const passengerName = ride.passenger?.name || 'Passenger';
  const fareBDT = Math.round(amount / 100);

  if (driverId) {
    await createNotification({
      userId: driverId,
      type: 'PAYMENT_CONFIRMED',
      message: `${passengerName} paid ৳${fareBDT} via ${chosenMethod === 'TESLAPAY' ? 'TeslaPay' : 'Cash'} and exited the vehicle.`,
      rideRequestId: rideId,
      poolId: ride.poolId ?? undefined,
    }).catch(() => {});
  }

  let poolCompleted = false;
  if (ride.poolId && ride.pool) {
    const remainingActive = ride.pool.rideRequests.filter(
      (r) => r.id !== rideId && r.stage !== 'CANCELLED' && r.stage !== 'COMPLETED'
    );

    const currentSeatsTaken = ride.pool.seatsTaken ?? ride.seats;
    const newSeatsTaken = Math.max(0, currentSeatsTaken - ride.seats);

    if (remainingActive.length === 0) {
      await prisma.pool.update({
        where: { id: ride.poolId },
        data: {
          currentLocation: ride.destinationZone,
          seatsTaken: 0,
          stage: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      poolCompleted = true;

      if (driverId) {
        await createNotification({
          userId: driverId,
          type: 'PAYMENT_CONFIRMED',
          message: 'All passengers have paid and ended their journey! Trip is completed.',
          poolId: ride.poolId,
        }).catch(() => {});
      }
    } else {
      await prisma.pool.update({
        where: { id: ride.poolId },
        data: {
          currentLocation: ride.destinationZone,
          seatsTaken: newSeatsTaken,
        },
      });
      poolCompleted = false;
    }
  }

  return {
    success: true,
    ride: updatedRide,
    poolCompleted,
  };
}