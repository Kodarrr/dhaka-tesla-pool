import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import { getPassengerHistory } from '../rides.service.js';
import { getDriverHistory, DriverError } from '../../driver/driver.service.js';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    rideRequest: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    tesla: {
      findUnique: vi.fn(),
    },
    pool: {
      findMany: vi.fn(),
    },
  },
}));

describe('History aggregations and views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Passenger history (CHANGE 1)', () => {
    it('returns passenger rides, aggregate total spent and count for COMPLETED only', async () => {
      const mockRides = [
        {
          id: 'ride-1',
          pickupZone: 'BANANI',
          destinationZone: 'GULSHAN',
          createdAt: new Date('2026-09-25T10:00:00Z'),
          stage: 'COMPLETED',
          totalFarePaisa: 28000,
          pool: {
            tesla: {
              driver: {
                name: 'Kalam Driver',
              },
            },
          },
        },
        {
          id: 'ride-2',
          pickupZone: 'GULSHAN',
          destinationZone: 'UTTARA',
          createdAt: new Date('2026-09-25T11:00:00Z'),
          stage: 'CANCELLED',
          totalFarePaisa: 46000,
          pool: null,
        },
        {
          id: 'ride-3',
          pickupZone: 'BANANI',
          destinationZone: 'MOHAKHALI',
          createdAt: new Date('2026-09-25T12:00:00Z'),
          stage: 'REQUESTED',
          totalFarePaisa: 19000,
          pool: {
            tesla: null,
          },
        },
      ];

      (prisma.rideRequest.findMany as any).mockResolvedValue(mockRides);
      (prisma.rideRequest.aggregate as any).mockResolvedValue({
        _sum: { totalFarePaisa: 28000 },
        _count: 1,
      });

      const result = await getPassengerHistory('passenger-123');

      // Verify aggregate query arguments match requirement
      expect(prisma.rideRequest.aggregate).toHaveBeenCalledWith({
        where: { passengerId: 'passenger-123', stage: 'COMPLETED' },
        _sum: { totalFarePaisa: true },
        _count: true,
      });

      expect(result.totalSpentPaisa).toBe(28000);
      expect(result.completedRideCount).toBe(1);
      expect(result.rides).toHaveLength(3);

      expect(result.rides[0]).toEqual({
        id: 'ride-1',
        pickupZone: 'BANANI',
        destinationZone: 'GULSHAN',
        createdAt: mockRides[0].createdAt,
        stage: 'COMPLETED',
        totalFarePaisa: 28000,
        driverName: 'Kalam Driver',
      });

      expect(result.rides[1].driverName).toBeNull();
      expect(result.rides[2].driverName).toBeNull();
    });
  });

  describe('Driver history (CHANGE 2)', () => {
    it('throws 404 if driver has no tesla', async () => {
      (prisma.tesla.findUnique as any).mockResolvedValue(null);

      await expect(getDriverHistory('driver-no-tesla')).rejects.toThrow(
        new DriverError(404, 'Register a Tesla first')
      );
    });

    it('returns completed trips, riders, trip earnings, and total income across completed trips', async () => {
      (prisma.tesla.findUnique as any).mockResolvedValue({
        id: 'tesla-1',
        driverId: 'driver-1',
        plate: 'DHK-TESLA-01',
      });

      const mockPools = [
        {
          id: 'pool-1',
          pickupZone: 'BANANI',
          completedAt: new Date('2026-09-25T14:00:00Z'),
          rideRequests: [
            {
              id: 'req-1',
              destinationZone: 'GULSHAN',
              seats: 1,
              totalFarePaisa: 19600,
              passenger: { name: 'Passenger A' },
            },
            {
              id: 'req-2',
              destinationZone: 'MOHAKHALI',
              seats: 2,
              totalFarePaisa: 39200,
              passenger: { name: 'Passenger B' },
            },
          ],
        },
        {
          id: 'pool-2',
          pickupZone: 'UTTARA',
          completedAt: new Date('2026-09-25T15:00:00Z'),
          rideRequests: [
            {
              id: 'req-3',
              destinationZone: 'MOTIJHEEL',
              seats: 1,
              totalFarePaisa: 49000,
              passenger: { name: 'Passenger C' },
            },
          ],
        },
      ];

      (prisma.pool.findMany as any).mockResolvedValue(mockPools);

      const result = await getDriverHistory('driver-1');

      // Verify pool query filter
      expect(prisma.pool.findMany).toHaveBeenCalledWith({
        where: {
          teslaId: 'tesla-1',
          stage: 'COMPLETED',
        },
        orderBy: { completedAt: 'desc' },
        include: {
          rideRequests: {
            where: {
              stage: { not: 'CANCELLED' },
            },
            include: {
              passenger: {
                select: { name: true },
              },
            },
          },
        },
      });

      expect(result.completedTripCount).toBe(2);
      expect(result.trips[0].tripEarningsPaisa).toBe(19600 + 39200);
      expect(result.trips[1].tripEarningsPaisa).toBe(49000);
      expect(result.totalIncomePaisa).toBe(19600 + 39200 + 49000);
      expect(result.trips[0].riders).toEqual([
        {
          name: 'Passenger A',
          destinationZone: 'GULSHAN',
          seats: 1,
          totalFarePaisa: 19600,
        },
        {
          name: 'Passenger B',
          destinationZone: 'MOHAKHALI',
          seats: 2,
          totalFarePaisa: 39200,
        },
      ]);
    });
  });
});
