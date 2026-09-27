import {
  Corridor,
  Zone,
  canJoinCorridorPool,
  findCorridorById,
  findCorridorForRiders,
} from '../../config/zones.js';
import { dhakaTree, TreeRoute, DirectedTreeEdge } from '../../config/city-tree.js';

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
  currentLocation?: string | null;
  corridorId: string | null;
  stage: string;
  seatsTaken: number;
  seatsCap: number;
  existingDestinations: string[];
  memberPassengerIds?: string[];
  activeRiders?: Array<{ pickupZone?: string; destinationZone: string }>;
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
  | 'corridor_incompatible'
  | 'opposite_direction'
  | 'disjoint_route'
  | 'passed_pickup';

export interface ShareEligibility {
  eligible: boolean;
  reason?: ShareIneligibilityReason;
  corridor?: Corridor;
  seatsRemaining?: number;
}

export interface TreeShareEligibility {
  eligible: boolean;
  reason?: ShareIneligibilityReason;
  overlapRatio: number;
  sharedEdges: DirectedTreeEdge[];
  isSubRoute: boolean;
  userRoute: TreeRoute;
  poolRoute: TreeRoute;
  seatsRemaining: number;
}

/**
 * Standard corridor-based candidate evaluation (preserved for backwards-compatibility).
 */
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

/**
 * Tree-Path Overlap Matching Algorithm (Phase 2).
 *
 * Checks if a candidate ride (e.g., Nusrat wanting to travel from pickupZone -> destinationZone)
 * is compatible with an existing pool's unique path on the Dhaka City Tree.
 *
 * Algorithm:
 * 1. Derives unique directed paths for both pool and user on the Dhaka spanning tree.
 * 2. Compares directed edges: verifies user travels in the SAME direction along the tree.
 * 3. Verifies vehicle's current location has not already passed the user's pickup node.
 * 4. Checks seat capacity and stage eligibility.
 * 5. Returns overlap ratio (1.0 = exact sub-route, >0 = partial branch sharing).
 */
export function evaluateTreeShareCandidate(
  pool: DiscoverablePoolSnapshot,
  query: ShareRouteQuery,
  options: { minOverlapThreshold?: number } = {}
): TreeShareEligibility {
  const minOverlap = options.minOverlapThreshold ?? 0.01;
  const userRoute = dhakaTree.getRoute(query.pickupZone, query.destinationZone);
  const seatsRemaining = pool.seatsCap - pool.seatsTaken;

  // Determine pool's primary route on the tree
  // Start from origin (or current location if available) to farthest destination
  const poolStart = (pool.pickupZone as Zone) || 'MOHAKHALI';
  const poolEnd = (pool.existingDestinations[pool.existingDestinations.length - 1] as Zone) || poolStart;
  const poolRoute = dhakaTree.getRoute(poolStart, poolEnd);

  // Check stage
  if (!isShareJoinableStage(pool.stage)) {
    return {
      eligible: false,
      reason: 'stage_closed',
      overlapRatio: 0,
      sharedEdges: [],
      isSubRoute: false,
      userRoute,
      poolRoute,
      seatsRemaining,
    };
  }

  // Check shareable flag
  if (!pool.shareable) {
    return {
      eligible: false,
      reason: 'not_shareable',
      overlapRatio: 0,
      sharedEdges: [],
      isSubRoute: false,
      userRoute,
      poolRoute,
      seatsRemaining,
    };
  }

  // Check seats
  if (seatsRemaining < query.seats) {
    return {
      eligible: false,
      reason: 'no_capacity',
      overlapRatio: 0,
      sharedEdges: [],
      isSubRoute: false,
      userRoute,
      poolRoute,
      seatsRemaining,
    };
  }

  // Check member membership
  if (query.passengerId && pool.memberPassengerIds?.includes(query.passengerId)) {
    return {
      eligible: false,
      reason: 'already_a_member',
      overlapRatio: 0,
      sharedEdges: [],
      isSubRoute: false,
      userRoute,
      poolRoute,
      seatsRemaining,
    };
  }

  // Check if vehicle has already passed user pickup on the tree path
  if (pool.currentLocation && poolRoute.path.includes(pool.currentLocation as Zone)) {
    const currIdx = poolRoute.path.indexOf(pool.currentLocation as Zone);
    const pickupIdx = poolRoute.path.indexOf(query.pickupZone);
    if (pickupIdx !== -1 && currIdx > pickupIdx) {
      return {
        eligible: false,
        reason: 'passed_pickup',
        overlapRatio: 0,
        sharedEdges: [],
        isSubRoute: false,
        userRoute,
        poolRoute,
        seatsRemaining,
      };
    }
  }

  // Compute directed tree edge overlap
  const sharedEdges = dhakaTree.getSharedEdges(poolRoute, userRoute);
  const overlapRatio = dhakaTree.getOverlapRatio(poolRoute, userRoute);
  const isSubRoute = dhakaTree.isSubRoute(poolRoute, userRoute);

  // If no edges overlap in the same direction:
  if (sharedEdges.length === 0) {
    // Check if traveling in opposite direction along any of the same tree edges
    const poolReversedEdges = new Set(poolRoute.edges.map((e) => `${e.to}->${e.from}`));
    const isOpposite = userRoute.edges.some((e) => poolReversedEdges.has(`${e.from}->${e.to}`));

    return {
      eligible: false,
      reason: isOpposite ? 'opposite_direction' : 'disjoint_route',
      overlapRatio: 0,
      sharedEdges: [],
      isSubRoute: false,
      userRoute,
      poolRoute,
      seatsRemaining,
    };
  }

  // Check if overlap meets threshold
  if (overlapRatio < minOverlap) {
    return {
      eligible: false,
      reason: 'disjoint_route',
      overlapRatio,
      sharedEdges,
      isSubRoute,
      userRoute,
      poolRoute,
      seatsRemaining,
    };
  }

  return {
    eligible: true,
    overlapRatio,
    sharedEdges,
    isSubRoute,
    userRoute,
    poolRoute,
    seatsRemaining,
  };
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
