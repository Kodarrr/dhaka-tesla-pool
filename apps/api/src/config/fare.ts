import {
  Zone,
  Corridor,
  getDistance,
  findCorridorForRoute,
  findCorridorById,
  findCorridorForRiders,
} from './zones.js';

// Trip-level base fare is not applied per corridor leg. Adjacent-leg price is
// distance × PER_KM_RATE_BDT so Banani → Mohakhali (2 km) is exactly 100 tk.
export const BASE_FARE_BDT = 100;
export const PER_KM_RATE_BDT = 50;
export const POOL_DISCOUNT_PCT = 0.3; // 30% off a leg when 2+ ride requests share it

export interface LegFareBreakdown {
  legIndex: number;
  fromZone: Zone;
  toZone: Zone;
  distanceKm: number;
  baseFareBDT: number;
  riderCount: number;
  discountPct: number;
  riderFareBDT: number;
  riderFarePaisa: number;
}

export interface RiderFareBreakdown {
  requestId: string;
  passengerName?: string;
  corridorId: string;
  corridorName: string;
  pickupZone: Zone;
  destinationZone: Zone;
  seats: number;
  legs: LegFareBreakdown[];
  sharedLegsCount: number;
  soloLegsCount: number;
  sharedPortionBDT: number;
  soloPortionBDT: number;
  sharedPortionPaisa: number;
  soloPortionPaisa: number;
  totalDiscountBDT: number;
  totalDiscountPaisa: number;
  totalFareBDT: number;
  totalFarePaisa: number;
}

export interface CorridorLegSummary {
  legIndex: number;
  fromZone: Zone;
  toZone: Zone;
  distanceKm: number;
  baseFareBDT: number;
  riderCount: number;
  discountPct: number;
  discountedFareBDT: number;
}

export interface CorridorPoolCalculationResult {
  corridorId: string;
  corridorName: string;
  pickupZone: Zone;
  farthestDestinationZone: Zone;
  legs: CorridorLegSummary[];
  riders: Record<string, RiderFareBreakdown>;
  totalPoolFareBDT: number;
  totalPoolFarePaisa: number;
}

export interface RiderRequestInput {
  requestId: string;
  passengerName?: string;
  pickupZone: Zone;
  destinationZone: Zone;
  seats?: number;
}

export interface CorridorPoolInput {
  corridor?: Corridor | string;
  pickupZone: Zone;
  riders: RiderRequestInput[];
  poolDiscountPct?: number;
  perKmRateBDT?: number;
}

/**
 * Calculates undiscounted base fare in BDT for an adjacent corridor leg based on distance.
 */
export function calculateLegBaseFare(
  fromZone: Zone,
  toZone: Zone,
  perKmRate: number = PER_KM_RATE_BDT
): number {
  const distanceKm = getDistance(fromZone, toZone);
  return distanceKm * perKmRate;
}

/**
 * Leg-by-leg corridor pooling fare calculator:
 * 1. Validates that all riders share pickupZone and lie on the same corridor in forward order.
 * 2. Slices corridor from pickup to the farthest destination into consecutive legs.
 * 3. On each leg, counts riders still present in the vehicle.
 * 4. If 2+ riders are present, applies POOL_DISCOUNT_PCT (default 30%).
 * 5. If 1 rider is present, charges full undiscounted price for that leg.
 * 6. Returns complete audit breakdown per rider (shared vs solo portion, per-leg details, total paisa).
 */
export function calculateCorridorPoolFares(input: CorridorPoolInput): CorridorPoolCalculationResult {
  const { pickupZone, riders, poolDiscountPct = POOL_DISCOUNT_PCT, perKmRateBDT = PER_KM_RATE_BDT } = input;

  if (riders.length === 0) {
    throw new Error('Cannot calculate corridor fares without riders');
  }

  // Resolve corridor: prefer an explicit id/object, otherwise the first corridor that fits every rider.
  let corridor: Corridor | undefined;
  if (typeof input.corridor === 'string') {
    corridor = findCorridorById(input.corridor);
  } else if (input.corridor) {
    corridor = input.corridor;
  } else {
    corridor =
      findCorridorForRiders(
        pickupZone,
        riders.map((r) => r.destinationZone)
      ) ?? undefined;
  }

  if (!corridor) {
    throw new Error(
      `No suitable corridor found for pickup ${pickupZone} and destination ${riders[0]?.destinationZone}`
    );
  }

  const pickupIdx = corridor.zones.indexOf(pickupZone);
  if (pickupIdx === -1) {
    throw new Error(`Pickup zone ${pickupZone} is not on corridor ${corridor.name}`);
  }

  // Validate all riders
  let maxDestIdx = pickupIdx;
  let farthestDestinationZone: Zone = pickupZone;

  for (const rider of riders) {
    if (rider.pickupZone !== pickupZone) {
      throw new Error(
        `Rider ${rider.requestId} has mismatched pickup ${rider.pickupZone}; expected ${pickupZone}`
      );
    }
    const destIdx = corridor.zones.indexOf(rider.destinationZone);
    if (destIdx === -1) {
      throw new Error(
        `Rider ${rider.requestId} destination ${rider.destinationZone} is not on corridor ${corridor.name}`
      );
    }
    if (pickupIdx >= destIdx) {
      throw new Error(
        `Rider ${rider.requestId} pickup ${pickupZone} must precede destination ${rider.destinationZone} on corridor ${corridor.name}`
      );
    }
    if (destIdx > maxDestIdx) {
      maxDestIdx = destIdx;
      farthestDestinationZone = rider.destinationZone;
    }
  }

  // Slice corridor into consecutive stops
  const corridorStops = corridor.zones.slice(pickupIdx, maxDestIdx + 1);
  const legCount = corridorStops.length - 1;

  // Build legs and compute rider occupancy on each leg
  const legs: CorridorLegSummary[] = [];

  for (let i = 0; i < legCount; i++) {
    const fromZone = corridorStops[i];
    const toZone = corridorStops[i + 1];
    const distanceKm = getDistance(fromZone, toZone);
    const baseFareBDT = calculateLegBaseFare(fromZone, toZone, perKmRateBDT);

    const toZoneIdxInCorridor = corridor.zones.indexOf(toZone);

    // Count distinct ride requests still onboard (destination at or beyond this leg).
    // Seats on a single request do not trigger a pool discount by themselves.
    let riderCount = 0;
    for (const r of riders) {
      const rDestIdx = corridor.zones.indexOf(r.destinationZone);
      if (rDestIdx >= toZoneIdxInCorridor) {
        riderCount += 1;
      }
    }

    const discountPct = riderCount >= 2 ? Math.round(poolDiscountPct * 100) : 0;
    const discountMultiplier = riderCount >= 2 ? 1 - poolDiscountPct : 1.0;
    const discountedFareBDT = Math.round(baseFareBDT * discountMultiplier);

    legs.push({
      legIndex: i,
      fromZone,
      toZone,
      distanceKm,
      baseFareBDT,
      riderCount,
      discountPct,
      discountedFareBDT,
    });
  }

  // Build rider breakdowns
  const riderResults: Record<string, RiderFareBreakdown> = {};
  let totalPoolFareBDT = 0;

  for (const rider of riders) {
    const rSeats = rider.seats ?? 1;
    const rDestIdx = corridor.zones.indexOf(rider.destinationZone);

    const riderLegs: LegFareBreakdown[] = [];
    let sharedLegsCount = 0;
    let soloLegsCount = 0;
    let sharedPortionBDT = 0;
    let soloPortionBDT = 0;
    let totalDiscountBDT = 0;
    let totalFareBDT = 0;

    for (const leg of legs) {
      const toZoneIdx = corridor.zones.indexOf(leg.toZone);
      // If rider is on this leg
      if (rDestIdx >= toZoneIdx) {
        const legRiderFareBDT = leg.discountedFareBDT * rSeats;
        const legBaseFareTotalBDT = leg.baseFareBDT * rSeats;
        const legDiscountBDT = legBaseFareTotalBDT - legRiderFareBDT;

        if (leg.riderCount >= 2) {
          sharedLegsCount++;
          sharedPortionBDT += legRiderFareBDT;
        } else {
          soloLegsCount++;
          soloPortionBDT += legRiderFareBDT;
        }

        totalDiscountBDT += legDiscountBDT;
        totalFareBDT += legRiderFareBDT;

        riderLegs.push({
          legIndex: leg.legIndex,
          fromZone: leg.fromZone,
          toZone: leg.toZone,
          distanceKm: leg.distanceKm,
          baseFareBDT: legBaseFareTotalBDT,
          riderCount: leg.riderCount,
          discountPct: leg.discountPct,
          riderFareBDT: legRiderFareBDT,
          riderFarePaisa: legRiderFareBDT * 100,
        });
      }
    }

    riderResults[rider.requestId] = {
      requestId: rider.requestId,
      passengerName: rider.passengerName,
      corridorId: corridor.id,
      corridorName: corridor.name,
      pickupZone,
      destinationZone: rider.destinationZone,
      seats: rSeats,
      legs: riderLegs,
      sharedLegsCount,
      soloLegsCount,
      sharedPortionBDT,
      soloPortionBDT,
      sharedPortionPaisa: sharedPortionBDT * 100,
      soloPortionPaisa: soloPortionBDT * 100,
      totalDiscountBDT,
      totalDiscountPaisa: totalDiscountBDT * 100,
      totalFareBDT,
      totalFarePaisa: totalFareBDT * 100,
    };

    totalPoolFareBDT += totalFareBDT;
  }

  return {
    corridorId: corridor.id,
    corridorName: corridor.name,
    pickupZone,
    farthestDestinationZone,
    legs,
    riders: riderResults,
    totalPoolFareBDT,
    totalPoolFarePaisa: totalPoolFareBDT * 100,
  };
}

/**
 * Calculates solo fare breakdown for a single rider along the best corridor.
 */
export function calculateSoloCorridorFare(
  pickupZone: Zone,
  destinationZone: Zone,
  seats: number = 1
): RiderFareBreakdown {
  const result = calculateCorridorPoolFares({
    pickupZone,
    riders: [{ requestId: 'solo', pickupZone, destinationZone, seats }],
  });
  return result.riders['solo'];
}

export interface FareCalculationResult {
  distanceKm: number;
  baseFareBDT: number;
  distanceChargeBDT: number;
  rawFareBDT: number;
  discountMultiplier: number;
  discountPercentage: number;
  perPersonFareBDT: number;
  totalFareBDT: number;
  baseFarePaisa: number;
  distanceChargePaisa: number;
  poolDiscountPaisa: number;
  totalFarePaisa: number;
  breakdown?: RiderFareBreakdown;
}

export function getFareMultiplier(passengerCount: number): number {
  if (passengerCount <= 1) return 1.0;
  return 1 - POOL_DISCOUNT_PCT; // 0.70 when 2+ riders share
}

/**
 * Backwards-compatible estimate and single-ride calculator.
 * Integrates corridor routing when a valid corridor exists.
 */
export function calculateFare(
  pickupZone: Zone,
  dropoffZone: Zone,
  passengerCount: number = 1
): FareCalculationResult {
  const corridor = findCorridorForRoute(pickupZone, dropoffZone);

  if (corridor) {
    const dummyRiders = Array.from({ length: passengerCount }).map((_, i) => ({
      requestId: `rider_${i + 1}`,
      pickupZone,
      destinationZone: dropoffZone,
      seats: 1,
    }));

    const poolResult = calculateCorridorPoolFares({
      corridor,
      pickupZone,
      riders: dummyRiders,
    });

    const sampleRider = poolResult.riders['rider_1'];
    const totalDistanceKm = sampleRider.legs.reduce((acc, leg) => acc + leg.distanceKm, 0);
    const totalBaseFareBDT = sampleRider.legs.reduce((acc, leg) => acc + leg.baseFareBDT, 0);
    const perPersonFareBDT = sampleRider.totalFareBDT;
    const totalFareBDT = poolResult.totalPoolFareBDT;
    const discountMultiplier = passengerCount >= 2 ? 1 - POOL_DISCOUNT_PCT : 1.0;
    const discountPercentage = passengerCount >= 2 ? Math.round(POOL_DISCOUNT_PCT * 100) : 0;

    return {
      distanceKm: totalDistanceKm,
      baseFareBDT: 0,
      distanceChargeBDT: totalBaseFareBDT,
      rawFareBDT: totalBaseFareBDT,
      discountMultiplier,
      discountPercentage,
      perPersonFareBDT,
      totalFareBDT,
      baseFarePaisa: 0,
      distanceChargePaisa: totalBaseFareBDT * 100,
      poolDiscountPaisa: sampleRider.totalDiscountPaisa * passengerCount,
      totalFarePaisa: totalFareBDT * 100,
      breakdown: sampleRider,
    };
  }

  // Fallback for non-corridor direct distance
  const distanceKm = getDistance(pickupZone, dropoffZone);
  const rawFareBDT = distanceKm * PER_KM_RATE_BDT;
  const multiplier = getFareMultiplier(passengerCount);
  const discountPercentage = Math.round((1 - multiplier) * 100);
  const perPersonFareBDT = Math.round(rawFareBDT * multiplier);
  const totalFareBDT = perPersonFareBDT * passengerCount;
  const standardTotalBDT = rawFareBDT * passengerCount;
  const discountAmountBDT = Math.max(0, standardTotalBDT - totalFareBDT);

  return {
    distanceKm,
    baseFareBDT: 0,
    distanceChargeBDT: rawFareBDT,
    rawFareBDT,
    discountMultiplier: multiplier,
    discountPercentage,
    perPersonFareBDT,
    totalFareBDT,
    baseFarePaisa: 0,
    distanceChargePaisa: rawFareBDT * 100,
    poolDiscountPaisa: Math.round(discountAmountBDT * 100),
    totalFarePaisa: Math.round(totalFareBDT * 100),
  };
}