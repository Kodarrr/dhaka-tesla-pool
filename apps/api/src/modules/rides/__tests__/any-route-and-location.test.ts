import { describe, it, expect } from 'vitest';
import { estimateRide, RideError } from '../rides.service.js';
import { joinPoolSchema } from '../rides.schema.js';
import { getDistance, DISTANCE_MATRIX } from '../../../config/zones.js';

describe('Any-to-Any Route & Dummy Location Tests', () => {
  it('allows estimating any distinct source and destination pair (e.g. DHANMONDI to UTTARA)', async () => {
    const estimate = await estimateRide({
      pickupZone: 'DHANMONDI',
      destinationZone: 'UTTARA',
      passengerCount: 1,
    });
    expect(estimate.pickupZone).toBe('DHANMONDI');
    expect(estimate.dropoffZone).toBe('UTTARA');
    expect(estimate.distanceKm).toBe(DISTANCE_MATRIX.DHANMONDI.UTTARA);
    expect(estimate.totalFareBDT).toBe(estimate.distanceKm * 50);
  });

  it('rejects route estimation when pickup and destination are the same zone', async () => {
    await expect(
      estimateRide({
        pickupZone: 'GULSHAN',
        destinationZone: 'GULSHAN',
        passengerCount: 1,
      })
    ).rejects.toThrow('Pickup and destination cannot be the same zone');
  });

  it('validates joinPoolSchema accepts both pickupZone and destinationZone', () => {
    const result = joinPoolSchema.safeParse({
      pickupZone: 'BANANI',
      destinationZone: 'DHANMONDI',
      seats: 2,
      paymentMethod: 'CASH',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pickupZone).toBe('BANANI');
      expect(result.data.destinationZone).toBe('DHANMONDI');
      expect(result.data.seats).toBe(2);
      expect(result.data.paymentMethod).toBe('CASH');
    }
  });

  it('calculates direct distance accurately for all zones in Dhaka', () => {
    expect(getDistance('UTTARA', 'MOTIJHEEL')).toBe(20);
    expect(getDistance('BASHUNDHARA', 'GULSHAN')).toBe(5);
    expect(getDistance('DHANMONDI', 'MOHAKHALI')).toBe(8);
  });
});

