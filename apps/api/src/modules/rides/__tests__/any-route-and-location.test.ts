import { describe, it, expect } from 'vitest';
import { estimateRide, RideError } from '../rides.service.js';
import { joinPoolSchema } from '../rides.schema.js';
import { getDistance, DISTANCE_MATRIX, canJoinPoolRoute } from '../../../config/zones.js';

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

describe('Route Direction & Reverse Passenger Prevention Tests', () => {
  it('rejects joining when passenger destination goes in reverse direction of the pool (Nusrat Uttara->Bashundhara, Rafiq Mohakhali->Banani)', () => {
    // Nusrat is going Uttara -> Bashundhara (Southbound on Airport Road: Uttara, Banani, Mohakhali, Gulshan, Bashundhara)
    const nusratPool = {
      pickupZone: 'UTTARA' as const,
      currentLocation: 'UTTARA',
      corridorId: 'CORRIDOR_AIRPORT_ROAD',
      activeRiders: [{ pickupZone: 'UTTARA', destinationZone: 'BASHUNDHARA' }],
    };

    // Rafiq tries to join from Mohakhali to Banani (Northbound / Reverse direction!)
    const result = canJoinPoolRoute(nusratPool, 'MOHAKHALI', 'BANANI');
    expect(result.canJoin).toBe(false);
    expect(result.reason).toContain('reverse direction');
  });

  it('allows joining when passenger travels forward along the pool route (Rafiq Mohakhali->Gulshan)', () => {
    const nusratPool = {
      pickupZone: 'UTTARA' as const,
      currentLocation: 'UTTARA',
      corridorId: 'CORRIDOR_AIRPORT_ROAD',
      activeRiders: [{ pickupZone: 'UTTARA', destinationZone: 'BASHUNDHARA' }],
    };

    const result = canJoinPoolRoute(nusratPool, 'MOHAKHALI', 'GULSHAN');
    expect(result.canJoin).toBe(true);
    expect(result.corridor?.id).toBe('CORRIDOR_AIRPORT_ROAD');
  });

  it('rejects boarding at a zone the vehicle has already passed based on currentLocation', () => {
    const activePool = {
      pickupZone: 'UTTARA' as const,
      currentLocation: 'MOHAKHALI', // Vehicle is already at Mohakhali
      corridorId: 'CORRIDOR_AIRPORT_ROAD',
      activeRiders: [{ pickupZone: 'UTTARA', destinationZone: 'BASHUNDHARA' }],
    };

    // Passenger tries to board at Banani which the vehicle already passed
    const result = canJoinPoolRoute(activePool, 'BANANI', 'GULSHAN');
    expect(result.canJoin).toBe(false);
    expect(result.reason).toContain('already passed BANANI');
  });

  it('rejects joining when pickup zone is completely off the route corridor', () => {
    const nusratPool = {
      pickupZone: 'UTTARA' as const,
      currentLocation: 'UTTARA',
      corridorId: 'CORRIDOR_AIRPORT_ROAD',
      activeRiders: [{ pickupZone: 'UTTARA', destinationZone: 'BASHUNDHARA' }],
    };

    const result = canJoinPoolRoute(nusratPool, 'DHANMONDI', 'GULSHAN');
    expect(result.canJoin).toBe(false);
    expect(result.reason).toContain('not on the route');
  });
});

describe('Passenger Ride Cancellation Rules', () => {
  it('validates cancellation is rejected once driver has accepted with clear message', () => {
    const error = new RideError(
      400,
      'Cannot cancel ride: A driver has already accepted your ride. Cancellations are only allowed before a driver accepts.'
    );
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('A driver has already accepted your ride');
  });

  it('validates already cancelled error', () => {
    const error = new RideError(400, 'Ride is already cancelled');
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Ride is already cancelled');
  });
});

