import {
  Corridor,
  Zone,
  DISTANCE_MATRIX,
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

export const TREE_SHARE_JOINABLE_STAGES = [
  'REQUESTED',
  'MATCHED',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
] as const;

export function isTreeShareJoinableStage(stage: string): boolean {
  return (TREE_SHARE_JOINABLE_STAGES as readonly string[]).includes(stage);
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
 * is compatible with an existing pool's path on the Dhaka City Tree.
 *
 * Matches if there is ANY common portion/edges traversed in the same forward direction,
 * even when the candidate's pickup is different from the pool's origin.
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
  const poolStart = (pool.pickupZone as Zone) || 'MOHAKHALI';
  const allDestinations = (pool.existingDestinations && pool.existingDestinations.length > 0)
    ? (pool.existingDestinations as Zone[])
    : [poolStart];
  const poolEnd = allDestinations[allDestinations.length - 1];
  const poolRoute = dhakaTree.getRoute(poolStart, poolEnd);

  // Check stage
  if (!isTreeShareJoinableStage(pool.stage)) {
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

  // Resolve pool corridor if any
  const corridor = pool.corridorId
    ? findCorridorById(pool.corridorId)
    : resolvePoolCorridor(pool, query.destinationZone);

  // Check if vehicle has already passed user pickup on the tree path or corridor
  if (pool.currentLocation) {
    const currLoc = pool.currentLocation as Zone;
    if (poolRoute.path.includes(currLoc)) {
      const currIdx = poolRoute.path.indexOf(currLoc);
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
    if (corridor) {
      const cZones = corridor.zones;
      const cCurrIdx = cZones.indexOf(currLoc);
      const cPickupIdx = cZones.indexOf(query.pickupZone);
      if (cCurrIdx !== -1 && cPickupIdx !== -1 && cCurrIdx > cPickupIdx) {
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
  }

  // Collect all directed edges covered by the pool
  const poolDirectedEdgeKeys = new Set<string>();
  const poolReversedEdgeKeys = new Set<string>();

  const registerEdge = (from: Zone, to: Zone) => {
    if (from === to) return;
    poolDirectedEdgeKeys.add(`${from}->${to}`);
    poolReversedEdgeKeys.add(`${to}->${from}`);
  };

  const registerTreeRoute = (from: Zone, to: Zone) => {
    if (from === to) return;
    const r = dhakaTree.getRoute(from, to);
    for (const e of r.edges) {
      registerEdge(e.from, e.to);
    }
  };

  // 1. Direct tree routes from start to each destination
  for (const dest of allDestinations) {
    registerTreeRoute(poolStart, dest);
    if (pool.currentLocation && pool.currentLocation !== poolStart) {
      registerTreeRoute(pool.currentLocation as Zone, dest);
    }
  }

  // 2. Active riders' tree routes
  if (pool.activeRiders && pool.activeRiders.length > 0) {
    for (const rider of pool.activeRiders) {
      const rPickup = (rider.pickupZone || pool.pickupZone) as Zone;
      const rDest = rider.destinationZone as Zone;
      registerTreeRoute(rPickup, rDest);
    }
  }

  // 3. Corridor edges if pool follows an identified corridor
  if (corridor) {
    const cZones = corridor.zones;
    const vehicleZone = (pool.currentLocation || pool.pickupZone) as Zone;
    const startIdx = Math.max(0, cZones.indexOf(vehicleZone));
    let maxDestIdx = startIdx;
    for (const dest of allDestinations) {
      const idx = cZones.indexOf(dest);
      if (idx > maxDestIdx) maxDestIdx = idx;
    }

    for (let i = startIdx; i < maxDestIdx && i < cZones.length - 1; i++) {
      const u = cZones[i];
      const v = cZones[i + 1];
      registerEdge(u, v);
      registerTreeRoute(u, v);
    }

    // If query pickup and destination are also on this corridor in forward direction:
    const qPIdx = cZones.indexOf(query.pickupZone);
    const qDIdx = cZones.indexOf(query.destinationZone);
    if (qPIdx !== -1 && qDIdx !== -1 && qPIdx < qDIdx && qPIdx >= startIdx && qDIdx <= maxDestIdx) {
      for (let i = qPIdx; i < qDIdx; i++) {
        const u = cZones[i];
        const v = cZones[i + 1];
        registerEdge(u, v);
        registerTreeRoute(u, v);
      }
    }
  }

  // Compute shared edges from userRoute
  const sharedEdges: DirectedTreeEdge[] = [];
  for (const edge of userRoute.edges) {
    if (poolDirectedEdgeKeys.has(`${edge.from}->${edge.to}`)) {
      sharedEdges.push(edge);
    }
  }

  // If tree edges didn't match directly, but user's direct hop or corridor hop is covered:
  if (sharedEdges.length === 0 && poolDirectedEdgeKeys.has(`${query.pickupZone}->${query.destinationZone}`)) {
    sharedEdges.push({
      from: query.pickupZone,
      to: query.destinationZone,
      distanceKm: DISTANCE_MATRIX[query.pickupZone][query.destinationZone],
    });
  }

  // Check opposite direction
  if (sharedEdges.length === 0) {
    const isOpposite = userRoute.edges.some((e) =>
      poolReversedEdgeKeys.has(`${e.from}->${e.to}`)
    ) || poolReversedEdgeKeys.has(`${query.pickupZone}->${query.destinationZone}`);

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

  const sharedDistanceKm = sharedEdges.reduce((sum, e) => sum + e.distanceKm, 0);
  const totalUserDistanceKm = userRoute.totalDistanceKm > 0 ? userRoute.totalDistanceKm : sharedDistanceKm;
  const overlapRatio = totalUserDistanceKm > 0 ? Math.min(1.0, sharedDistanceKm / totalUserDistanceKm) : 1.0;
  const isSubRoute = dhakaTree.isSubRoute(poolRoute, userRoute) || overlapRatio >= 0.99;

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
