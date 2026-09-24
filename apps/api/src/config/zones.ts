export const ZONES = [
  'GULSHAN',
  'BANANI',
  'MOHAKHALI',
  'DHANMONDI',
  'UTTARA',
  'MOTIJHEEL',
  'BASHUNDHARA',
] as const;

export type Zone = (typeof ZONES)[number];

export function isZone(value: unknown): value is Zone {
  return typeof value === 'string' && ZONES.includes(value as Zone);
}

export interface Corridor {
  id: string;
  name: string;
  zones: readonly Zone[];
}

/**
 * Ordered one-way corridors. A corridor is a straight-line sequence of zones;
 * the reverse direction is a separate corridor. Gulshan 1 in the assignment
 * maps to GULSHAN. CORRIDORS order is the preference when several match.
 */
export const CORRIDORS: readonly Corridor[] = [
  {
    id: 'CORRIDOR_AIRPORT_ROAD',
    name: 'Airport Road (Southbound)',
    zones: ['UTTARA', 'BANANI', 'MOHAKHALI', 'GULSHAN', 'BASHUNDHARA'],
  },
  {
    id: 'CORRIDOR_AIRPORT_ROAD_NORTH',
    name: 'Airport Road (Northbound)',
    zones: ['BASHUNDHARA', 'GULSHAN', 'MOHAKHALI', 'BANANI', 'UTTARA'],
  },
  {
    id: 'CORRIDOR_NORTH_SOUTH',
    name: 'North-South Arterial (Southbound)',
    zones: ['UTTARA', 'BANANI', 'MOHAKHALI', 'MOTIJHEEL'],
  },
  {
    id: 'CORRIDOR_NORTH_SOUTH_NORTH',
    name: 'North-South Arterial (Northbound)',
    zones: ['MOTIJHEEL', 'MOHAKHALI', 'BANANI', 'UTTARA'],
  },
  {
    id: 'CORRIDOR_WEST_EAST',
    name: 'West-East Connector',
    zones: ['DHANMONDI', 'MOHAKHALI', 'GULSHAN'],
  },
  {
    id: 'CORRIDOR_WEST_EAST_REV',
    name: 'East-West Connector',
    zones: ['GULSHAN', 'MOHAKHALI', 'DHANMONDI'],
  },
] as const;

// 2D distance matrix in kilometers between each zone pair in Dhaka
export const DISTANCE_MATRIX: Record<Zone, Record<Zone, number>> = {
  GULSHAN: {
    GULSHAN: 0,
    BANANI: 3,
    MOHAKHALI: 1,
    DHANMONDI: 10,
    UTTARA: 12,
    MOTIJHEEL: 11,
    BASHUNDHARA: 5,
  },
  BANANI: {
    GULSHAN: 3,
    BANANI: 0,
    MOHAKHALI: 2,
    DHANMONDI: 10,
    UTTARA: 10,
    MOTIJHEEL: 13,
    BASHUNDHARA: 6,
  },
  MOHAKHALI: {
    GULSHAN: 1,
    BANANI: 2,
    MOHAKHALI: 0,
    DHANMONDI: 8,
    UTTARA: 12,
    MOTIJHEEL: 9,
    BASHUNDHARA: 7,
  },
  DHANMONDI: {
    GULSHAN: 10,
    BANANI: 10,
    MOHAKHALI: 8,
    DHANMONDI: 0,
    UTTARA: 18,
    MOTIJHEEL: 6,
    BASHUNDHARA: 15,
  },
  UTTARA: {
    GULSHAN: 12,
    BANANI: 10,
    MOHAKHALI: 12,
    DHANMONDI: 18,
    UTTARA: 0,
    MOTIJHEEL: 20,
    BASHUNDHARA: 8,
  },
  MOTIJHEEL: {
    GULSHAN: 11,
    BANANI: 13,
    MOHAKHALI: 9,
    DHANMONDI: 6,
    UTTARA: 20,
    MOTIJHEEL: 0,
    BASHUNDHARA: 14,
  },
  BASHUNDHARA: {
    GULSHAN: 5,
    BANANI: 6,
    MOHAKHALI: 7,
    DHANMONDI: 15,
    UTTARA: 8,
    MOTIJHEEL: 14,
    BASHUNDHARA: 0,
  },
};

export function getDistance(pickupZone: Zone, dropoffZone: Zone): number {
  const pickup = DISTANCE_MATRIX[pickupZone];
  if (!pickup) {
    throw new Error(`Invalid pickup zone: ${pickupZone}`);
  }
  const distance = pickup[dropoffZone];
  if (distance === undefined) {
    throw new Error(`Invalid dropoff zone: ${dropoffZone}`);
  }
  return distance;
}

export function findCorridorById(corridorId: string): Corridor | undefined {
  return CORRIDORS.find((c) => c.id === corridorId);
}

function isForwardOnCorridor(corridor: Corridor, pickupZone: Zone, destinationZone: Zone): boolean {
  const pickupIdx = corridor.zones.indexOf(pickupZone);
  const destIdx = corridor.zones.indexOf(destinationZone);
  return pickupIdx !== -1 && destIdx !== -1 && pickupIdx < destIdx;
}

/**
 * Finds all corridors where pickup comes before destination in corridor order.
 * First match in CORRIDORS is the preferred corridor when several apply.
 */
export function findCorridorsForRoute(pickupZone: Zone, destinationZone: Zone): Corridor[] {
  return CORRIDORS.filter((corridor) => isForwardOnCorridor(corridor, pickupZone, destinationZone));
}

/**
 * Finds the first corridor that contains pickup and every destination in forward order.
 * Used when a pool has mixed drop-offs (e.g. Mohakhali + Motijheel from Banani → North-South, not Airport Road).
 */
export function findCorridorForRiders(pickupZone: Zone, destinationZones: readonly Zone[]): Corridor | null {
  if (destinationZones.length === 0) {
    return null;
  }

  return (
    CORRIDORS.find((corridor) =>
      destinationZones.every((destinationZone) => isForwardOnCorridor(corridor, pickupZone, destinationZone))
    ) ?? null
  );
}

/**
 * Finds the first matching corridor for a pickup and destination zone pair.
 */
export function findCorridorForRoute(pickupZone: Zone, destinationZone: Zone): Corridor | null {
  const corridors = findCorridorsForRoute(pickupZone, destinationZone);
  return corridors[0] ?? null;
}

/**
 * Determines whether a new ride request can pool with an existing pool corridor.
 * Rule: same pickupZone, destinationZone lies on the corridor after pickupZone.
 */
export function canJoinCorridorPool(
  corridor: Corridor,
  pickupZone: Zone,
  destinationZone: Zone
): { canJoin: boolean; reason?: string } {
  const pickupIdx = corridor.zones.indexOf(pickupZone);
  if (pickupIdx === -1) {
    return { canJoin: false, reason: `Pickup zone ${pickupZone} is not on corridor ${corridor.name}` };
  }

  const destIdx = corridor.zones.indexOf(destinationZone);
  if (destIdx === -1) {
    return { canJoin: false, reason: `Destination zone ${destinationZone} is not on corridor ${corridor.name}` };
  }

  if (pickupIdx >= destIdx) {
    return {
      canJoin: false,
      reason: `Pickup zone ${pickupZone} does not precede destination ${destinationZone} on corridor ${corridor.name}`,
    };
  }

  return { canJoin: true };
}

/**
 * Determines whether two ride requests can pool together.
 * Rule:
 * 1. Same pickupZone
 * 2. Both destinations lie on the same corridor
 * 3. pickupZone comes before both destinations in corridor order
 */
export function canPoolRideRequests(
  reqA: { pickupZone: Zone; destinationZone: Zone },
  reqB: { pickupZone: Zone; destinationZone: Zone }
): { canPool: boolean; corridor?: Corridor; reason?: string } {
  if (reqA.pickupZone !== reqB.pickupZone) {
    return { canPool: false, reason: 'Ride requests have different pickup zones' };
  }

  for (const corridor of CORRIDORS) {
    const pIdx = corridor.zones.indexOf(reqA.pickupZone);
    if (pIdx === -1) continue;

    const destAIdx = corridor.zones.indexOf(reqA.destinationZone);
    const destBIdx = corridor.zones.indexOf(reqB.destinationZone);

    if (destAIdx !== -1 && destBIdx !== -1 && pIdx < destAIdx && pIdx < destBIdx) {
      return { canPool: true, corridor };
    }
  }

  return {
    canPool: false,
    reason: `No corridor found connecting pickup ${reqA.pickupZone} forward to both ${reqA.destinationZone} and ${reqB.destinationZone}`,
  };
}

/**
 * Slices the corridor between pickup and farthest destination into consecutive legs.
 */
export function getCorridorLegs(
  corridor: Corridor,
  pickupZone: Zone,
  farthestDestinationZone: Zone
): Array<{ fromZone: Zone; toZone: Zone; distanceKm: number }> {
  const pickupIdx = corridor.zones.indexOf(pickupZone);
  const destIdx = corridor.zones.indexOf(farthestDestinationZone);

  if (pickupIdx === -1 || destIdx === -1 || pickupIdx >= destIdx) {
    throw new Error(
      `Invalid route on corridor ${corridor.id}: pickup ${pickupZone} (idx ${pickupIdx}), destination ${farthestDestinationZone} (idx ${destIdx})`
    );
  }

  const legs: Array<{ fromZone: Zone; toZone: Zone; distanceKm: number }> = [];
  for (let i = pickupIdx; i < destIdx; i++) {
    const fromZone = corridor.zones[i];
    const toZone = corridor.zones[i + 1];
    legs.push({
      fromZone,
      toZone,
      distanceKm: getDistance(fromZone, toZone),
    });
  }

  return legs;
}
