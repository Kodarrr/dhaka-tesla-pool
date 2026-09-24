import { describe, it, expect } from 'vitest';
import { ZONES, getDistance } from '../zones.js';
import {
  calculateFare,
  getFareMultiplier,
  BASE_FARE_BDT,
  PER_KM_RATE_BDT,
} from '../fare.js';

describe('Zones & Distance Matrix Engine', () => {
  it('should define all 5 core Dhaka zones', () => {
    expect(ZONES).toEqual(['GULSHAN', 'BANANI', 'DHANMONDI', 'UTTARA', 'MOTIJHEEL']);
  });

  it('should return 0 km for trips within the same zone', () => {
    for (const zone of ZONES) {
      expect(getDistance(zone, zone)).toBe(0);
    }
  });

  it('should correctly lookup known distances between zone pairs', () => {
    expect(getDistance('GULSHAN', 'BANANI')).toBe(3);
    expect(getDistance('GULSHAN', 'DHANMONDI')).toBe(10);
    expect(getDistance('GULSHAN', 'UTTARA')).toBe(12);
    expect(getDistance('GULSHAN', 'MOTIJHEEL')).toBe(11);
    expect(getDistance('DHANMONDI', 'MOTIJHEEL')).toBe(6);
  });

  it('should be symmetric across all zone pairs', () => {
    for (const z1 of ZONES) {
      for (const z2 of ZONES) {
        expect(getDistance(z1, z2)).toBe(getDistance(z2, z1));
      }
    }
  });
});

describe('Dynamic Fare Calculation Engine', () => {
  it('should calculate correct raw fare before discounts (Base 100 BDT + 30 BDT/KM)', () => {
    const result3km = calculateFare('GULSHAN', 'BANANI', 1);
    expect(result3km.distanceKm).toBe(3);
    expect(result3km.baseFareBDT).toBe(BASE_FARE_BDT);
    expect(result3km.distanceChargeBDT).toBe(3 * PER_KM_RATE_BDT);
    expect(result3km.rawFareBDT).toBe(190);

    const result6km = calculateFare('DHANMONDI', 'MOTIJHEEL', 1);
    expect(result6km.distanceKm).toBe(6);
    expect(result6km.rawFareBDT).toBe(280);

    const result10km = calculateFare('GULSHAN', 'DHANMONDI', 1);
    expect(result10km.distanceKm).toBe(10);
    expect(result10km.rawFareBDT).toBe(400);
  });

  it('should apply 1 Rider rate (100% fare, 0% discount)', () => {
    const result = calculateFare('GULSHAN', 'DHANMONDI', 1);
    expect(result.discountMultiplier).toBe(1.0);
    expect(result.discountPercentage).toBe(0);
    expect(result.perPersonFareBDT).toBe(400);
    expect(result.totalFareBDT).toBe(400);
    expect(result.totalFarePaisa).toBe(40000);
  });

  it('should apply 2 Riders dynamic discount (30% discount per person, 0.70x)', () => {
    const result = calculateFare('GULSHAN', 'DHANMONDI', 2);
    expect(result.discountMultiplier).toBe(0.70);
    expect(result.discountPercentage).toBe(30);
    expect(result.perPersonFareBDT).toBe(280);
    expect(result.totalFareBDT).toBe(560);
    expect(result.poolDiscountPaisa).toBe(24000);
    expect(result.totalFarePaisa).toBe(56000);
  });

  it('should apply 3 Riders dynamic discount (45% discount per person, 0.55x)', () => {
    const result = calculateFare('GULSHAN', 'DHANMONDI', 3);
    expect(result.discountMultiplier).toBe(0.55);
    expect(result.discountPercentage).toBe(45);
    expect(result.perPersonFareBDT).toBe(220);
    expect(result.totalFareBDT).toBe(660);
    expect(result.poolDiscountPaisa).toBe(54000);
    expect(result.totalFarePaisa).toBe(66000);
  });

  it('should correctly expose discount multiplier mapping', () => {
    expect(getFareMultiplier(1)).toBe(1.0);
    expect(getFareMultiplier(2)).toBe(0.70);
    expect(getFareMultiplier(3)).toBe(0.55);
    expect(getFareMultiplier(4)).toBe(0.55);
  });
});