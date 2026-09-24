export const ZONES = [
  'GULSHAN',
  'BANANI',
  'DHANMONDI',
  'UTTARA',
  'MOTIJHEEL',
] as const;

export type Zone = (typeof ZONES)[number];

export function isZone(value: unknown): value is Zone {
  return typeof value === 'string' && ZONES.includes(value as Zone);
}

// 2D distance matrix in kilometers between each zone pair in Dhaka
export const DISTANCE_MATRIX: Record<Zone, Record<Zone, number>> = {
  GULSHAN: {
    GULSHAN: 0,
    BANANI: 3,
    DHANMONDI: 10,
    UTTARA: 12,
    MOTIJHEEL: 11,
  },
  BANANI: {
    GULSHAN: 3,
    BANANI: 0,
    DHANMONDI: 10,
    UTTARA: 10,
    MOTIJHEEL: 13,
  },
  DHANMONDI: {
    GULSHAN: 10,
    BANANI: 10,
    DHANMONDI: 0,
    UTTARA: 18,
    MOTIJHEEL: 6,
  },
  UTTARA: {
    GULSHAN: 12,
    BANANI: 10,
    DHANMONDI: 18,
    UTTARA: 0,
    MOTIJHEEL: 20,
  },
  MOTIJHEEL: {
    GULSHAN: 11,
    BANANI: 13,
    DHANMONDI: 6,
    UTTARA: 20,
    MOTIJHEEL: 0,
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