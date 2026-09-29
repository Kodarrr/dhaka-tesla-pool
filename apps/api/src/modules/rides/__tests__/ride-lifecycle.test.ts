import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import { updateRideStatus, RideError } from '../rides.service.js';

vi.mock('../../../lib/prisma.js', () => {
  return {
    prisma: {
      rideRequest: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      pool: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      tesla: {
        findUnique: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      notification: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn(),
    },
  };
});

describe('Ride Lifecycle & Stage Transitions (updateRideStatus)', () => {
  const driverId = 'driver-jashim-1';
  const passengerId = 'passenger-nusrat-1';
  const rideId = 'ride-nusrat-1';
  const poolId = 'pool-1';
  const teslaId = 'tesla-bullet-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid stage names with 400', async () => {
    await expect(
      updateRideStatus(driverId, 'DRIVER', rideId, 'FLYING')
    ).rejects.toThrow(/Invalid stage 'FLYING'/);
  });

  it('rejects nonexistent ride or pool with 404', async () => {
    (prisma.rideRequest.findUnique as any).mockResolvedValue(null);
    (prisma.pool.findUnique as any).mockResolvedValue(null);

    await expect(
      updateRideStatus(driverId, 'DRIVER', 'nonexistent-id', 'MATCHED')
    ).rejects.toThrow(/Ride or Pool not found/);
  });

  describe('Valid Stage Transitions', () => {
    it('transitions REQUESTED -> MATCHED and records matchedAt', async () => {
      const mockRide = {
        id: rideId,
        passengerId,
        poolId,
        stage: 'REQUESTED',
        pool: {
          id: poolId,
          stage: 'REQUESTED',
          teslaId: null,
          rideRequests: [{ id: rideId, passengerId, stage: 'REQUESTED' }],
        },
      };

      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);
      (prisma.tesla.findUnique as any).mockResolvedValue({
        id: teslaId,
        driverId,
        isOnline: true,
        driver: { id: driverId, name: 'Jashim' },
      });

      const updatedPool = { ...mockRide.pool, stage: 'MATCHED', teslaId };
      (prisma.$transaction as any).mockResolvedValue([updatedPool]);

      const result = await updateRideStatus(driverId, 'DRIVER', rideId, 'MATCHED');

      expect(result.success).toBe(true);
      expect(result.stage).toBe('MATCHED');
      expect(prisma.$transaction).toHaveBeenCalled();

      // Check pool update contains matchedAt
      expect(prisma.pool.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: poolId },
          data: expect.objectContaining({
            stage: 'MATCHED',
            matchedAt: expect.any(Date),
            teslaId,
          }),
        })
      );
      // Check ride update contains matchedAt
      expect(prisma.rideRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { poolId, stage: { not: 'CANCELLED' } },
          data: expect.objectContaining({
            stage: 'MATCHED',
            matchedAt: expect.any(Date),
          }),
        })
      );
    });

    it('transitions MATCHED -> DRIVER_ARRIVED and records arrivedAt', async () => {
      const mockRide = {
        id: rideId,
        passengerId,
        poolId,
        stage: 'MATCHED',
        pool: {
          id: poolId,
          stage: 'MATCHED',
          teslaId,
          rideRequests: [{ id: rideId, passengerId, stage: 'MATCHED' }],
        },
      };

      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);
      (prisma.tesla.findUnique as any).mockResolvedValue({
        id: teslaId,
        driverId,
        isOnline: true,
        driver: { id: driverId, name: 'Jashim' },
      });

      const updatedPool = { ...mockRide.pool, stage: 'DRIVER_ARRIVED' };
      (prisma.$transaction as any).mockResolvedValue([updatedPool]);

      const result = await updateRideStatus(driverId, 'DRIVER', rideId, 'DRIVER_ARRIVED');

      expect(result.success).toBe(true);
      expect(result.stage).toBe('DRIVER_ARRIVED');
      expect(prisma.pool.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: poolId },
          data: expect.objectContaining({
            stage: 'DRIVER_ARRIVED',
            arrivedAt: expect.any(Date),
          }),
        })
      );
    });

    it('transitions DRIVER_ARRIVED -> IN_PROGRESS', async () => {
      const mockRide = {
        id: rideId,
        passengerId,
        poolId,
        stage: 'DRIVER_ARRIVED',
        pool: {
          id: poolId,
          stage: 'DRIVER_ARRIVED',
          teslaId,
          rideRequests: [{ id: rideId, passengerId, stage: 'DRIVER_ARRIVED' }],
        },
      };

      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);
      (prisma.tesla.findUnique as any).mockResolvedValue({
        id: teslaId,
        driverId,
        isOnline: true,
        driver: { id: driverId, name: 'Jashim' },
      });

      const updatedPool = { ...mockRide.pool, stage: 'IN_PROGRESS' };
      (prisma.$transaction as any).mockResolvedValue([updatedPool]);

      const result = await updateRideStatus(driverId, 'DRIVER', rideId, 'IN_PROGRESS');

      expect(result.success).toBe(true);
      expect(result.stage).toBe('IN_PROGRESS');
      expect(prisma.pool.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: poolId },
          data: expect.objectContaining({ stage: 'IN_PROGRESS' }),
        })
      );
      expect(prisma.rideRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { poolId, stage: { not: 'CANCELLED' } },
          data: expect.objectContaining({ stage: 'IN_PROGRESS' }),
        })
      );
    });

    it('transitions IN_PROGRESS -> COMPLETED, setting completedAt and marking payment PAID', async () => {
      const mockRide = {
        id: rideId,
        passengerId,
        poolId,
        stage: 'IN_PROGRESS',
        destinationZone: 'MOHAKHALI',
        pool: {
          id: poolId,
          stage: 'IN_PROGRESS',
          teslaId,
          pickupZone: 'BANANI',
          rideRequests: [{ id: rideId, passengerId, stage: 'IN_PROGRESS' }],
        },
      };

      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);
      (prisma.tesla.findUnique as any).mockResolvedValue({
        id: teslaId,
        driverId,
        isOnline: true,
        driver: { id: driverId, name: 'Jashim' },
      });

      const updatedPool = { ...mockRide.pool, stage: 'COMPLETED' };
      (prisma.$transaction as any).mockResolvedValue([updatedPool]);

      const result = await updateRideStatus(driverId, 'DRIVER', rideId, 'COMPLETED');

      expect(result.success).toBe(true);
      expect(result.stage).toBe('COMPLETED');
      expect(prisma.pool.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: poolId },
          data: expect.objectContaining({
            stage: 'COMPLETED',
            completedAt: expect.any(Date),
          }),
        })
      );
      expect(prisma.rideRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { poolId, stage: { not: 'CANCELLED' } },
          data: expect.objectContaining({
            stage: 'COMPLETED',
            completedAt: expect.any(Date),
            paymentStatus: 'PAID',
            paidAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('Invalid State Transitions (Enforcement)', () => {
    it('rejects skipping from REQUESTED directly to COMPLETED', async () => {
      const mockRide = {
        id: rideId,
        stage: 'REQUESTED',
        pool: { id: poolId, stage: 'REQUESTED' },
      };
      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);

      await expect(
        updateRideStatus(driverId, 'DRIVER', rideId, 'COMPLETED')
      ).rejects.toThrow(/Invalid stage transition from REQUESTED to COMPLETED/);
    });

    it('rejects skipping from MATCHED directly to COMPLETED', async () => {
      const mockRide = {
        id: rideId,
        stage: 'MATCHED',
        pool: { id: poolId, stage: 'MATCHED' },
      };
      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);

      await expect(
        updateRideStatus(driverId, 'DRIVER', rideId, 'COMPLETED')
      ).rejects.toThrow(/Invalid stage transition from MATCHED to COMPLETED/);
    });

    it('rejects transitioning out of COMPLETED terminal state', async () => {
      const mockRide = {
        id: rideId,
        stage: 'COMPLETED',
        pool: { id: poolId, stage: 'COMPLETED' },
      };
      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);

      await expect(
        updateRideStatus(driverId, 'DRIVER', rideId, 'IN_PROGRESS')
      ).rejects.toThrow(/Invalid stage transition from COMPLETED to IN_PROGRESS/);
    });

    it('rejects transitioning out of CANCELLED terminal state', async () => {
      const mockRide = {
        id: rideId,
        stage: 'CANCELLED',
        pool: { id: poolId, stage: 'CANCELLED' },
      };
      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);

      await expect(
        updateRideStatus(driverId, 'DRIVER', rideId, 'MATCHED')
      ).rejects.toThrow(/Invalid stage transition from CANCELLED to MATCHED/);
    });
  });

  describe('Authorization Rules', () => {
    it('rejects non-driver role attempting to trigger driver stages with 403', async () => {
      const mockRide = {
        id: rideId,
        passengerId,
        stage: 'REQUESTED',
        pool: { id: poolId, stage: 'REQUESTED' },
      };
      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);

      await expect(
        updateRideStatus(passengerId, 'PASSENGER', rideId, 'MATCHED')
      ).rejects.toThrow(/Only drivers are authorized to update ride status/);
    });

    it('rejects offline driver attempting to accept pool with 400', async () => {
      const mockRide = {
        id: rideId,
        passengerId,
        stage: 'REQUESTED',
        pool: { id: poolId, stage: 'REQUESTED' },
      };
      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);
      (prisma.tesla.findUnique as any).mockResolvedValue({
        id: teslaId,
        driverId,
        isOnline: false, // OFFLINE
      });

      await expect(
        updateRideStatus(driverId, 'DRIVER', rideId, 'MATCHED')
      ).rejects.toThrow(/Driver is offline/);
    });

    it('rejects driver who is not the assigned driver with 403', async () => {
      const mockRide = {
        id: rideId,
        stage: 'MATCHED',
        pool: {
          id: poolId,
          stage: 'MATCHED',
          teslaId: 'different-tesla-id', // Assigned to someone else
        },
      };
      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);
      (prisma.tesla.findUnique as any).mockResolvedValue({
        id: teslaId,
        driverId,
        isOnline: true,
      });

      await expect(
        updateRideStatus(driverId, 'DRIVER', rideId, 'DRIVER_ARRIVED')
      ).rejects.toThrow(/You are not the assigned driver for this ride\/pool/);
    });

    it('rejects passenger cancellation once driver has already accepted with 400', async () => {
      const mockRide = {
        id: rideId,
        passengerId,
        stage: 'MATCHED',
        pool: { id: poolId, stage: 'MATCHED', teslaId },
      };
      (prisma.rideRequest.findUnique as any).mockResolvedValue(mockRide);

      await expect(
        updateRideStatus(passengerId, 'PASSENGER', rideId, 'CANCELLED')
      ).rejects.toThrow(/Cannot cancel ride once driver has accepted/);
    });
  });
});

