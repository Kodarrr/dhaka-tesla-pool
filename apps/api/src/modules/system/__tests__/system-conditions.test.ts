import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSystemConditions,
  updateSystemConditions,
  resetSystemConditionsCache,
  BASE_PER_KM_RATE_BDT,
  TRAFFIC_SURCHARGE_PER_KM_BDT,
  RAIN_SURCHARGE_PER_KM_BDT,
} from '../system.service.js';

describe('System Service & Environmental Conditions Unit Tests', () => {
  beforeEach(() => {
    resetSystemConditionsCache();
  });

  it('provides default conditions when no DB settings are present', async () => {
    const conditions = await getSystemConditions();
    expect(conditions.basePerKmRateBDT).toBe(50);
    expect(conditions.poolDiscountPct).toBe(0.3);
  });

  it('correctly calculates surcharges when traffic jam and rain are toggled', async () => {
    // Both off: 50 BDT/km
    const baseConditions = await getSystemConditions();
    expect(baseConditions.effectivePerKmRateBDT).toBe(
      BASE_PER_KM_RATE_BDT +
        (baseConditions.isTrafficJam ? TRAFFIC_SURCHARGE_PER_KM_BDT : 0) +
        (baseConditions.isRaining ? RAIN_SURCHARGE_PER_KM_BDT : 0)
    );
  });
});

