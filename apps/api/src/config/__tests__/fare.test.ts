import { describe, it, expect } from 'vitest';
import {
  ZONES,
  CORRIDORS,
  getDistance,
  canPoolRideRequests,
  canJoinCorridorPool,
  getCorridorLegs,
  findCorridorForRiders,
} from '../zones.js';
import {
  calculateLegBaseFare,
  calculateCorridorPoolFares,
  calculateSoloCorridorFare,
  POOL_DISCOUNT_PCT,
} from '../fare.js';

describe('Corridors, Zones & Distance Matrix Engine', () => {
  it('should define core Dhaka zones including Mohakhali and Bashundhara', () => {
    expect(ZONES).toContain('BANANI');
    expect(ZONES).toContain('MOHAKHALI');
    expect(ZONES).toContain('GULSHAN');
    expect(ZONES).toContain('UTTARA');
    expect(ZONES).toContain('DHANMONDI');
    expect(ZONES).toContain('MOTIJHEEL');
    expect(ZONES).toContain('BASHUNDHARA');
  });

  it('should return 0 km for trips within the same zone', () => {
    for (const zone of ZONES) {
      expect(getDistance(zone, zone)).toBe(0);
    }
  });

  it('should verify straight-line distances along Airport Road corridor', () => {
    // Banani -> Mohakhali: 2 km
    expect(getDistance('BANANI', 'MOHAKHALI')).toBe(2);
    // Mohakhali -> Gulshan: 1 km
    expect(getDistance('MOHAKHALI', 'GULSHAN')).toBe(1);
    // Banani -> Gulshan total: 3 km
    expect(getDistance('BANANI', 'GULSHAN')).toBe(3);
  });

  it('should be symmetric across all defined zone pairs', () => {
    for (const z1 of ZONES) {
      for (const z2 of ZONES) {
        expect(getDistance(z1, z2)).toBe(getDistance(z2, z1));
      }
    }
  });

  it('should define ordered corridors with straight-line routes', () => {
    const airportRoad = CORRIDORS.find((c) => c.id === 'CORRIDOR_AIRPORT_ROAD');
    expect(airportRoad).toBeDefined();
    expect(airportRoad?.zones).toEqual([
      'UTTARA',
      'BANANI',
      'MOHAKHALI',
      'GULSHAN',
      'BASHUNDHARA',
    ]);
  });
});

describe('Corridor Matching & Pooling Eligibility Rules', () => {
  it('should allow Nusrat and Rafiq to pool (same pickup Banani, both destinations on Airport Road in order)', () => {
    const nusrat = { pickupZone: 'BANANI' as const, destinationZone: 'MOHAKHALI' as const };
    const rafiq = { pickupZone: 'BANANI' as const, destinationZone: 'GULSHAN' as const };

    const poolCheck = canPoolRideRequests(nusrat, rafiq);
    expect(poolCheck.canPool).toBe(true);
    expect(poolCheck.corridor?.id).toBe('CORRIDOR_AIRPORT_ROAD');
  });

  it('should reject pooling if pickup zones differ', () => {
    const reqA = { pickupZone: 'BANANI' as const, destinationZone: 'GULSHAN' as const };
    const reqB = { pickupZone: 'UTTARA' as const, destinationZone: 'GULSHAN' as const };

    const poolCheck = canPoolRideRequests(reqA, reqB);
    expect(poolCheck.canPool).toBe(false);
    expect(poolCheck.reason).toContain('different pickup zones');
  });

  it('should reject pooling if one rider heads backwards along corridor order', () => {
    const airportRoad = CORRIDORS.find((c) => c.id === 'CORRIDOR_AIRPORT_ROAD')!;
    // On Southbound Airport Road, Banani is after Uttara, so Banani -> Uttara is backwards
    const joinCheck = canJoinCorridorPool(airportRoad, 'BANANI', 'UTTARA');
    expect(joinCheck.canJoin).toBe(false);
    expect(joinCheck.reason).toContain('does not precede');
  });

  it('should not pool Banani→Mohakhali with Banani→Dhanmondi (no shared forward corridor)', () => {
    const poolCheck = canPoolRideRequests(
      { pickupZone: 'BANANI', destinationZone: 'MOHAKHALI' },
      { pickupZone: 'BANANI', destinationZone: 'DHANMONDI' }
    );
    expect(poolCheck.canPool).toBe(false);
  });

  it('should select a corridor that contains every mixed destination', () => {
    const corridor = findCorridorForRiders('BANANI', ['MOHAKHALI', 'MOTIJHEEL']);
    expect(corridor?.id).toBe('CORRIDOR_NORTH_SOUTH');
  });

  it('should slice corridor into consecutive adjacent legs', () => {
    const airportRoad = CORRIDORS.find((c) => c.id === 'CORRIDOR_AIRPORT_ROAD')!;
    // Banani -> Gulshan passes through Mohakhali
    const legs = getCorridorLegs(airportRoad, 'BANANI', 'GULSHAN');
    expect(legs).toHaveLength(2);
    expect(legs[0]).toEqual({ fromZone: 'BANANI', toZone: 'MOHAKHALI', distanceKm: 2 });
    expect(legs[1]).toEqual({ fromZone: 'MOHAKHALI', toZone: 'GULSHAN', distanceKm: 1 });
  });
});

describe('Leg-by-Leg Fare Engine (Assignment Worked Example)', () => {
  it('should correctly calculate undiscounted leg base fares (2km = 100 BDT, 1km = 50 BDT)', () => {
    const leg1Fare = calculateLegBaseFare('BANANI', 'MOHAKHALI');
    expect(leg1Fare).toBe(100); // 2 km * 50 BDT/km = 100 BDT

    const leg2Fare = calculateLegBaseFare('MOHAKHALI', 'GULSHAN');
    expect(leg2Fare).toBe(50); // 1 km * 50 BDT/km = 50 BDT
  });

  it('WORKED EXAMPLE STEP 1: Nusrat requests first (solo Banani -> Mohakhali = 100 tk)', () => {
    const soloNusrat = calculateCorridorPoolFares({
      pickupZone: 'BANANI',
      riders: [
        {
          requestId: 'nusrat-req-1',
          passengerName: 'Nusrat',
          pickupZone: 'BANANI',
          destinationZone: 'MOHAKHALI',
        },
      ],
    });

    const nusrat = soloNusrat.riders['nusrat-req-1'];
    expect(nusrat).toBeDefined();
    // Only 1 leg: Banani -> Mohakhali
    expect(nusrat.legs).toHaveLength(1);
    expect(nusrat.legs[0].riderCount).toBe(1);
    expect(nusrat.legs[0].discountPct).toBe(0);
    expect(nusrat.legs[0].riderFareBDT).toBe(100);

    // Solo fare is exactly 100 tk (10,000 paisa)
    expect(nusrat.totalFareBDT).toBe(100);
    expect(nusrat.totalFarePaisa).toBe(10000);
    expect(nusrat.soloPortionBDT).toBe(100);
    expect(nusrat.sharedPortionBDT).toBe(0);
    expect(nusrat.totalDiscountBDT).toBe(0);
  });

  it('WORKED EXAMPLE STEP 2: Rafiq joins the same pool (Banani -> Gulshan)', () => {
    /**
     * Nusrat: Banani -> Mohakhali
     * Rafiq: Banani -> Gulshan (Mohakhali between Banani and Gulshan)
     *
     * Leg 1 (Banani -> Mohakhali):
     * - 2 riders (Nusrat, Rafiq) -> 30% discount applied
     * - Leg fare: 100 BDT * 0.70 = 70 BDT for each rider
     * - Nusrat destination reached -> pays 70 tk total!
     *
     * Leg 2 (Mohakhali -> Gulshan):
     * - Only Rafiq remaining (1 rider) -> full price (50 BDT)
     * - Rafiq pays 70 (shared leg) + 50 (full price of Mohakhali -> Gulshan leg) = 120 BDT!
     */
    const poolResult = calculateCorridorPoolFares({
      pickupZone: 'BANANI',
      riders: [
        {
          requestId: 'nusrat-req-1',
          passengerName: 'Nusrat',
          pickupZone: 'BANANI',
          destinationZone: 'MOHAKHALI',
        },
        {
          requestId: 'rafiq-req-2',
          passengerName: 'Rafiq',
          pickupZone: 'BANANI',
          destinationZone: 'GULSHAN',
        },
      ],
    });

    // Check legs
    expect(poolResult.legs).toHaveLength(2);
    expect(poolResult.legs[0]).toMatchObject({
      fromZone: 'BANANI',
      toZone: 'MOHAKHALI',
      baseFareBDT: 100,
      riderCount: 2,
      discountPct: 30,
      discountedFareBDT: 70,
    });
    expect(poolResult.legs[1]).toMatchObject({
      fromZone: 'MOHAKHALI',
      toZone: 'GULSHAN',
      baseFareBDT: 50,
      riderCount: 1,
      discountPct: 0,
      discountedFareBDT: 50,
    });

    // Validate Nusrat's recalculated fare
    const nusrat = poolResult.riders['nusrat-req-1'];
    expect(nusrat.totalFareBDT).toBe(70);
    expect(nusrat.totalFarePaisa).toBe(7000);
    expect(nusrat.sharedPortionBDT).toBe(70);
    expect(nusrat.soloPortionBDT).toBe(0);
    expect(nusrat.totalDiscountBDT).toBe(30);

    // Validate Rafiq's fare: 70 tk (his share of shared leg) + 50 tk (full price of solo leg) = 120 tk
    const rafiq = poolResult.riders['rafiq-req-2'];
    expect(rafiq.totalFareBDT).toBe(120);
    expect(rafiq.totalFarePaisa).toBe(12000);
    expect(rafiq.sharedPortionBDT).toBe(70);
    expect(rafiq.soloPortionBDT).toBe(50);
    expect(rafiq.totalDiscountBDT).toBe(30);

    // Total pool fare
    expect(poolResult.totalPoolFareBDT).toBe(190);
    expect(poolResult.totalPoolFarePaisa).toBe(19000);
  });

  it('WORKED EXAMPLE STEP 3: Recompute when Nusrat cancels (Rafiq reverts to full solo price)', () => {
    // Nusrat cancels -> only Rafiq remains in pool
    const soloRafiq = calculateCorridorPoolFares({
      pickupZone: 'BANANI',
      riders: [
        {
          requestId: 'rafiq-req-2',
          passengerName: 'Rafiq',
          pickupZone: 'BANANI',
          destinationZone: 'GULSHAN',
        },
      ],
    });

    const rafiq = soloRafiq.riders['rafiq-req-2'];
    expect(rafiq.legs).toHaveLength(2);
    // Both legs are now 1 rider (full price: 100 + 50 = 150 BDT)
    expect(rafiq.legs[0].riderCount).toBe(1);
    expect(rafiq.legs[0].riderFareBDT).toBe(100);
    expect(rafiq.legs[1].riderCount).toBe(1);
    expect(rafiq.legs[1].riderFareBDT).toBe(50);

    expect(rafiq.totalFareBDT).toBe(150);
    expect(rafiq.totalFarePaisa).toBe(15000);
    expect(rafiq.soloPortionBDT).toBe(150);
    expect(rafiq.sharedPortionBDT).toBe(0);
    expect(rafiq.totalDiscountBDT).toBe(0);
  });

  it('WORKED EXAMPLE STEP 4: 3rd passenger joins (Shirin: Banani -> Mohakhali)', () => {
    const poolResult = calculateCorridorPoolFares({
      pickupZone: 'BANANI',
      riders: [
        {
          requestId: 'nusrat-req-1',
          passengerName: 'Nusrat',
          pickupZone: 'BANANI',
          destinationZone: 'MOHAKHALI',
        },
        {
          requestId: 'rafiq-req-2',
          passengerName: 'Rafiq',
          pickupZone: 'BANANI',
          destinationZone: 'GULSHAN',
        },
        {
          requestId: 'shirin-req-3',
          passengerName: 'Shirin',
          pickupZone: 'BANANI',
          destinationZone: 'MOHAKHALI',
        },
      ],
    });

    // Leg 1 (Banani -> Mohakhali): 3 riders (Nusrat, Rafiq, Shirin) -> 30% discount = 70 BDT
    expect(poolResult.legs[0].riderCount).toBe(3);
    expect(poolResult.legs[0].discountPct).toBe(30);
    expect(poolResult.legs[0].discountedFareBDT).toBe(70);

    // Leg 2 (Mohakhali -> Gulshan): 1 rider (Rafiq) -> 50 BDT
    expect(poolResult.legs[1].riderCount).toBe(1);
    expect(poolResult.legs[1].discountPct).toBe(0);

    expect(poolResult.riders['nusrat-req-1'].totalFareBDT).toBe(70);
    expect(poolResult.riders['shirin-req-3'].totalFareBDT).toBe(70);
    expect(poolResult.riders['rafiq-req-2'].totalFareBDT).toBe(120);
  });

  it('applies the same 30% leg discount for 3 riders (not the old 45% trip-wide rate)', () => {
    expect(POOL_DISCOUNT_PCT).toBe(0.3);
  });

  it('does not discount a solo request that books two seats', () => {
    const result = calculateCorridorPoolFares({
      pickupZone: 'BANANI',
      riders: [
        {
          requestId: 'pair-req',
          pickupZone: 'BANANI',
          destinationZone: 'MOHAKHALI',
          seats: 2,
        },
      ],
    });

    const pair = result.riders['pair-req'];
    expect(result.legs[0].riderCount).toBe(1);
    expect(result.legs[0].discountPct).toBe(0);
    expect(pair.totalFareBDT).toBe(200);
  });

  it('picks North-South when mixed drop-offs are Mohakhali and Motijheel', () => {
    const result = calculateCorridorPoolFares({
      pickupZone: 'BANANI',
      riders: [
        { requestId: 'a', pickupZone: 'BANANI', destinationZone: 'MOHAKHALI' },
        { requestId: 'b', pickupZone: 'BANANI', destinationZone: 'MOTIJHEEL' },
      ],
    });

    expect(result.corridorId).toBe('CORRIDOR_NORTH_SOUTH');
    expect(result.legs.map((leg) => `${leg.fromZone}->${leg.toZone}`)).toEqual([
      'BANANI->MOHAKHALI',
      'MOHAKHALI->MOTIJHEEL',
    ]);
    expect(result.riders['a'].totalFareBDT).toBe(70);
    // Shared Banani→Mohakhali (70) + solo Mohakhali→Motijheel (9 km × 50 = 450)
    expect(result.riders['b'].totalFareBDT).toBe(520);
  });
});

describe('Audit Trail & Historical Breakdown Verification', () => {
  it('should store complete audit breakdown needed for support investigations', () => {
    const poolResult = calculateCorridorPoolFares({
      pickupZone: 'BANANI',
      riders: [
        {
          requestId: 'nusrat-req-1',
          passengerName: 'Nusrat',
          pickupZone: 'BANANI',
          destinationZone: 'MOHAKHALI',
        },
        {
          requestId: 'rafiq-req-2',
          passengerName: 'Rafiq',
          pickupZone: 'BANANI',
          destinationZone: 'GULSHAN',
        },
      ],
    });

    const breakdown = poolResult.riders['rafiq-req-2'];

    // Verify support can inspect exactly how the historical fare was formed:
    expect(breakdown.corridorId).toBe('CORRIDOR_AIRPORT_ROAD');
    expect(breakdown.pickupZone).toBe('BANANI');
    expect(breakdown.destinationZone).toBe('GULSHAN');

    // Leg 1 breakdown
    expect(breakdown.legs[0].fromZone).toBe('BANANI');
    expect(breakdown.legs[0].toZone).toBe('MOHAKHALI');
    expect(breakdown.legs[0].distanceKm).toBe(2);
    expect(breakdown.legs[0].baseFareBDT).toBe(100);
    expect(breakdown.legs[0].riderCount).toBe(2);
    expect(breakdown.legs[0].discountPct).toBe(30);
    expect(breakdown.legs[0].riderFareBDT).toBe(70);

    // Leg 2 breakdown
    expect(breakdown.legs[1].fromZone).toBe('MOHAKHALI');
    expect(breakdown.legs[1].toZone).toBe('GULSHAN');
    expect(breakdown.legs[1].distanceKm).toBe(1);
    expect(breakdown.legs[1].baseFareBDT).toBe(50);
    expect(breakdown.legs[1].riderCount).toBe(1);
    expect(breakdown.legs[1].discountPct).toBe(0);
    expect(breakdown.legs[1].riderFareBDT).toBe(50);

    // Summary portions for display
    expect(breakdown.sharedPortionBDT).toBe(70);
    expect(breakdown.soloPortionBDT).toBe(50);
    expect(breakdown.totalFareBDT).toBe(120);
    expect(breakdown.totalFarePaisa).toBe(12000);

    expect(() => JSON.stringify(breakdown)).not.toThrow();
    const persisted = JSON.parse(JSON.stringify(breakdown));
    expect(persisted.legs).toHaveLength(2);
    expect(persisted.totalFarePaisa).toBe(12000);
  });

  it('solo helper matches the Banani→Mohakhali 100 tk assignment fare', () => {
    const solo = calculateSoloCorridorFare('BANANI', 'MOHAKHALI');
    expect(solo.totalFareBDT).toBe(100);
    expect(solo.corridorId).toBe('CORRIDOR_AIRPORT_ROAD');
  });
});
