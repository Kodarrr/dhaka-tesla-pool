import { describe, it, expect } from 'vitest';
import { evaluateShareCandidate, evaluateTreeShareCandidate } from '../share-discovery.js';
import {
  availableSharesQuerySchema,
  joinPoolSchema,
  requestRideSchema,
} from '../rides.schema.js';

function nusratPool(overrides: Partial<Parameters<typeof evaluateShareCandidate>[0]> = {}) {
  return {
    id: 'pool-nusrat',
    shareable: true,
    pickupZone: 'BANANI',
    corridorId: 'CORRIDOR_AIRPORT_ROAD',
    stage: 'REQUESTED',
    seatsTaken: 1,
    seatsCap: 3,
    existingDestinations: ['MOHAKHALI'],
    memberPassengerIds: ['nusrat'],
    ...overrides,
  };
}

describe('available-shares discovery query', () => {
  const rafiq = {
    pickupZone: 'BANANI' as const,
    destinationZone: 'GULSHAN' as const,
    seats: 1,
    passengerId: 'rafiq',
  };

  it('lets Rafiq join Nusrat when both head down Airport Road from Banani', () => {
    const result = evaluateShareCandidate(nusratPool(), rafiq);
    expect(result.eligible).toBe(true);
    expect(result.corridor?.id).toBe('CORRIDOR_AIRPORT_ROAD');
    expect(result.seatsRemaining).toBe(2);
  });

  it('never returns a private (shareable=false) pool', () => {
    const result = evaluateShareCandidate(nusratPool({ shareable: false }), rafiq);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('not_shareable');
  });

  it('stays joinable after a driver accepts (MATCHED)', () => {
    const result = evaluateShareCandidate(nusratPool({ stage: 'MATCHED' }), rafiq);
    expect(result.eligible).toBe(true);
  });

  it('closes sharing once the pool has DRIVER_ARRIVED', () => {
    const result = evaluateShareCandidate(nusratPool({ stage: 'DRIVER_ARRIVED' }), rafiq);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('stage_closed');
  });

  it('requires the same pickup zone', () => {
    const result = evaluateShareCandidate(nusratPool({ pickupZone: 'UTTARA' }), rafiq);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('pickup_mismatch');
  });

  it('rejects when remaining seats are insufficient', () => {
    const result = evaluateShareCandidate(nusratPool({ seatsTaken: 2, seatsCap: 3 }), {
      ...rafiq,
      seats: 2,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no_capacity');
  });

  it('rejects a destination that is not forward on the pool corridor', () => {
    const result = evaluateShareCandidate(nusratPool(), {
      pickupZone: 'BANANI',
      destinationZone: 'DHANMONDI',
      seats: 1,
      passengerId: 'rafiq',
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('corridor_incompatible');
  });

  it('hides a pool the querying passenger is already on', () => {
    const result = evaluateShareCandidate(nusratPool(), {
      pickupZone: 'BANANI',
      destinationZone: 'GULSHAN',
      seats: 1,
      passengerId: 'nusrat',
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('already_a_member');
  });
});

describe('evaluateTreeShareCandidate - Tree-Path Overlap Matching', () => {
  function activeLongPool() {
    return {
      id: 'pool-long-tree',
      shareable: true,
      pickupZone: 'UTTARA',
      currentLocation: 'UTTARA',
      corridorId: null,
      stage: 'REQUESTED',
      seatsTaken: 1,
      seatsCap: 3,
      existingDestinations: ['MOTIJHEEL'],
      memberPassengerIds: ['rider-1'],
    };
  }

  it('matches when passenger route is an exact sub-path along the pool tree route', () => {
    // Pool: Uttara -> Motijheel. Nusrat wants: Gulshan -> Motijheel
    const match = evaluateTreeShareCandidate(activeLongPool(), {
      pickupZone: 'GULSHAN',
      destinationZone: 'MOTIJHEEL',
      seats: 1,
      passengerId: 'nusrat',
    });

    expect(match.eligible).toBe(true);
    expect(match.isSubRoute).toBe(true);
    expect(match.overlapRatio).toBe(1.0);
    expect(match.sharedEdges.length).toBeGreaterThan(0);
    expect(match.seatsRemaining).toBe(2);
  });

  it('rejects passengers requesting opposite direction on the tree', () => {
    // Pool heads South towards Motijheel; passenger wants to head North towards Uttara
    const match = evaluateTreeShareCandidate(activeLongPool(), {
      pickupZone: 'DHANMONDI',
      destinationZone: 'UTTARA',
      seats: 1,
      passengerId: 'reverse-rider',
    });

    expect(match.eligible).toBe(false);
    expect(match.reason).toBe('opposite_direction');
  });

  it('rejects when pool vehicle has already passed the passengers pickup node', () => {
    const passedPool = {
      ...activeLongPool(),
      currentLocation: 'MOHAKHALI', // Has already passed Uttara, Bashundhara, Gulshan
    };

    const match = evaluateTreeShareCandidate(passedPool, {
      pickupZone: 'GULSHAN',
      destinationZone: 'MOTIJHEEL',
      seats: 1,
      passengerId: 'late-rider',
    });

    expect(match.eligible).toBe(false);
    expect(match.reason).toBe('passed_pickup');
  });

  it('rejects when remaining seats are insufficient', () => {
    const fullPool = {
      ...activeLongPool(),
      seatsTaken: 3,
      seatsCap: 3,
    };

    const match = evaluateTreeShareCandidate(fullPool, {
      pickupZone: 'GULSHAN',
      destinationZone: 'MOTIJHEEL',
      seats: 1,
      passengerId: 'extra-rider',
    });

    expect(match.eligible).toBe(false);
    expect(match.reason).toBe('no_capacity');
  });
});

describe('Zod schemas for share flow', () => {
  it('defaults a new request to private (openToShare false, maxShareSeats 0)', () => {
    const parsed = requestRideSchema.parse({
      pickupZone: 'BANANI',
      destinationZone: 'MOHAKHALI',
    });
    expect(parsed.openToShare).toBe(false);
    expect(parsed.maxShareSeats).toBe(0);
    expect(parsed.seats).toBe(1);
  });

  it('rejects seats + maxShareSeats above 3', () => {
    const parsed = requestRideSchema.safeParse({
      pickupZone: 'BANANI',
      destinationZone: 'MOHAKHALI',
      seats: 2,
      openToShare: true,
      maxShareSeats: 2,
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts openToShare with 2 extra seats when the requester takes 1', () => {
    const parsed = requestRideSchema.parse({
      pickupZone: 'BANANI',
      destinationZone: 'MOHAKHALI',
      seats: 1,
      openToShare: true,
      maxShareSeats: 2,
    });
    expect(parsed.openToShare).toBe(true);
    expect(parsed.maxShareSeats).toBe(2);
  });

  it('parses available-shares query params including coerced seats', () => {
    const parsed = availableSharesQuerySchema.parse({
      pickupZone: 'BANANI',
      destinationZone: 'GULSHAN',
      seats: '1',
    });
    expect(parsed.seats).toBe(1);
  });

  it('requires destinationZone on join', () => {
    expect(joinPoolSchema.safeParse({ seats: 1 }).success).toBe(false);
    expect(joinPoolSchema.parse({ destinationZone: 'GULSHAN', seats: 1 }).destinationZone).toBe(
      'GULSHAN'
    );
  });
});
