import { Zone, getDistance } from './zones.js';

export const BASE_FARE_BDT = 100;
export const PER_KM_RATE_BDT = 30;

// Dynamic Discount Matrix:
// 1 Rider: 100% fare (1.0x) -> 0% discount
// 2 Riders: 30% discount per person (0.70x)
// 3 Riders: 45% discount per person (0.55x)
export const DISCOUNT_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 0.70,
  3: 0.55,
};

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
}

export function getFareMultiplier(passengerCount: number): number {
  if (passengerCount <= 1) return DISCOUNT_MULTIPLIERS[1];
  if (passengerCount === 2) return DISCOUNT_MULTIPLIERS[2];
  return DISCOUNT_MULTIPLIERS[3];
}

export function calculateFare(
  pickupZone: Zone,
  dropoffZone: Zone,
  passengerCount: number = 1
): FareCalculationResult {
  const distanceKm = getDistance(pickupZone, dropoffZone);
  const baseFareBDT = BASE_FARE_BDT;
  const distanceChargeBDT = distanceKm * PER_KM_RATE_BDT;
  const rawFareBDT = baseFareBDT + distanceChargeBDT;

  const multiplier = getFareMultiplier(passengerCount);
  const discountPercentage = Math.round((1 - multiplier) * 100);

  const perPersonFareBDT = Math.round(rawFareBDT * multiplier);
  const totalFareBDT = perPersonFareBDT * passengerCount;

  const standardTotalBDT = rawFareBDT * passengerCount;
  const discountAmountBDT = Math.max(0, standardTotalBDT - totalFareBDT);

  return {
    distanceKm,
    baseFareBDT,
    distanceChargeBDT,
    rawFareBDT,
    discountMultiplier: multiplier,
    discountPercentage,
    perPersonFareBDT,
    totalFareBDT,
    baseFarePaisa: baseFareBDT * 100,
    distanceChargePaisa: distanceChargeBDT * 100,
    poolDiscountPaisa: Math.round(discountAmountBDT * 100),
    totalFarePaisa: Math.round(totalFareBDT * 100),
  };
}

