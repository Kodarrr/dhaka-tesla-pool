import { prisma } from '../../lib/prisma.js';

export const BASE_PER_KM_RATE_BDT = 50;
export const TRAFFIC_SURCHARGE_PER_KM_BDT = 10; // +20% surcharge per km
export const RAIN_SURCHARGE_PER_KM_BDT = 10;    // +20% surcharge per km
export const POOL_DISCOUNT_PCT = 0.3;          // 30% pooling discount

export interface SystemConditions {
  isTrafficJam: boolean;
  isRaining: boolean;
  basePerKmRateBDT: number;
  trafficSurchargeBDT: number;
  rainSurchargeBDT: number;
  effectivePerKmRateBDT: number;
  poolDiscountPct: number;
}

// In-memory cache for ultra-fast response with DB synchronization
let cachedConditions: { isTrafficJam: boolean; isRaining: boolean } | null = null;

export async function getSystemConditions(): Promise<SystemConditions> {
  if (cachedConditions === null) {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: { key: { in: ['traffic_jam', 'raining'] } },
      });
      const trafficRow = settings.find((s) => s.key === 'traffic_jam');
      const rainRow = settings.find((s) => s.key === 'raining');

      cachedConditions = {
        isTrafficJam: trafficRow ? trafficRow.value === 'true' : false,
        isRaining: rainRow ? rainRow.value === 'true' : false,
      };
    } catch {
      // Default fallback if DB is not ready during tests/migration
      cachedConditions = { isTrafficJam: false, isRaining: false };
    }
  }

  const isTrafficJam = cachedConditions.isTrafficJam;
  const isRaining = cachedConditions.isRaining;
  const trafficSurchargeBDT = isTrafficJam ? TRAFFIC_SURCHARGE_PER_KM_BDT : 0;
  const rainSurchargeBDT = isRaining ? RAIN_SURCHARGE_PER_KM_BDT : 0;
  const effectivePerKmRateBDT = BASE_PER_KM_RATE_BDT + trafficSurchargeBDT + rainSurchargeBDT;

  return {
    isTrafficJam,
    isRaining,
    basePerKmRateBDT: BASE_PER_KM_RATE_BDT,
    trafficSurchargeBDT,
    rainSurchargeBDT,
    effectivePerKmRateBDT,
    poolDiscountPct: POOL_DISCOUNT_PCT,
  };
}

export async function updateSystemConditions(input: {
  isTrafficJam?: boolean;
  isRaining?: boolean;
}): Promise<SystemConditions> {
  const current = await getSystemConditions();

  const nextTraffic = input.isTrafficJam !== undefined ? input.isTrafficJam : current.isTrafficJam;
  const nextRain = input.isRaining !== undefined ? input.isRaining : current.isRaining;

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: 'traffic_jam' },
      update: { value: String(nextTraffic) },
      create: { key: 'traffic_jam', value: String(nextTraffic) },
    }),
    prisma.systemSetting.upsert({
      where: { key: 'raining' },
      update: { value: String(nextRain) },
      create: { key: 'raining', value: String(nextRain) },
    }),
  ]);

  cachedConditions = {
    isTrafficJam: nextTraffic,
    isRaining: nextRain,
  };

  return getSystemConditions();
}

/**
 * Resets conditions cache (useful in tests)
 */
export function resetSystemConditionsCache() {
  cachedConditions = null;
}

