import {
  Corridor,
  Zone,
  canJoinCorridorPool,
  findCorridorById,
  findCorridorForRiders,
} from '../../config/zones.js';

/**
 * Sharing window: open until the trip actually starts.
 * MATCHED (driver accepted) and DRIVER_ARRIVED stay joinable; STARTED does not.
 */
export const SHARE_JOINABLE_STAGES = ['REQUESTED', 'MATCHED'] as const;

export type ShareJoinableStage = (typeof SHARE_JOINABLE_STAGES)[number];

export function isShareJoinableStage(stage: string): stage is ShareJoinableStage {
  return (SHARE_JOINABLE_STAGES as readonly string[]).includes(stage);
}

export interface DiscoverablePoolSnapshot {
  id: string;
  shareable: boolean;
  pickupZone: string;
  corridorId: string | null;
  stage: string;
  seatsTaken: number;
  seatsCap: number;
  existingDestinations: string[];
  memberPassengerIds?: string[];
}

export interface ShareRouteQuery {
  pickupZone: Zone;
  destinationZone: Zone;
  seats: number;
  passengerId?: string;
}

export type ShareIneligibilityReason =
  | 'not_shareable'
  | 'stage_closed'
  | 'pickup_mismatch'
  | 'no_capacity'
  | 'already_a_member'
  | 'corridor_incompatible';

export interface ShareEligibility {
  eligible: boolean;
  reason?: ShareIneligibilityReason;
  corridor?: Corridor;
  seatsRemaining?: number;
}

export function evaluateShareCandidate(
  pool: DiscoverablePoolSnapshot,
  query: ShareRouteQuery
): ShareEligibility {
  if (!pool.shareable) {
    return { eligible: false, reason: 'not_shareable' };
  }

  if (!isShareJoinableStage(pool.stage)) {
    return { eligible: false, reason: 'stage_closed' };
  }

  if (pool.pickupZone !== query.pickupZone) {
    return { eligible: false, reason: 'pickup_mismatch' };
  }

  const seatsRemaining = pool.seatsCap - pool.seatsTaken;
  if (seatsRemaining < query.seats) {
    return { eligible: false, reason: 'no_capacity' };
  }

  if (query.passengerId && pool.memberPassengerIds?.includes(query.passengerId)) {
    return { eligible: false, reason: 'already_a_member' };
  }

  const corridor = resolvePoolCorridor(pool, query.destinationZone);
  if (!corridor) {
    return { eligible: false, reason: 'corridor_incompatible' };
  }

  const joinCheck = canJoinCorridorPool(corridor, query.pickupZone, query.destinationZone);
  if (!joinCheck.canJoin) {
    return { eligible: false, reason: 'corridor_incompatible' };
  }

  return { eligible: true, corridor, seatsRemaining };
}

function resolvePoolCorridor(
  pool: DiscoverablePoolSnapshot,
  joiningDestination: Zone
): Corridor | undefined {
  if (pool.corridorId) {
    return findCorridorById(pool.corridorId);
  }

  const destinations = [...pool.existingDestinations, joiningDestination] as Zone[];
  return findCorridorForRiders(pool.pickupZone as Zone, destinations) ?? undefined;
}
