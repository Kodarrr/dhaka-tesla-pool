import { describe, it, expect } from 'vitest';
import { evaluateShareCandidate } from '../share-discovery.js';
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
