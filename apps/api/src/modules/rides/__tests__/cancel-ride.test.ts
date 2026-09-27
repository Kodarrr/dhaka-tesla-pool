import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import { cancelRide, RideError } from '../rides.service.js';

vi.mock('../../../lib/prisma.js', () => {
  return {
    prisma: {
      $transaction: vi.fn(),
      rideRequest: {
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      pool: {
        update: vi.fn(),
      },
    },
  };
});

describe('Ride Cancellation Authorization & Stage Constraints', () => {
  const userNusrat = 'user-nusrat-id';
  const userRafiq = 'user-rafiq-id';
  const rideOfRafiqId = 'ride-rafiq-101';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents User A (Nusrat) from cancelling User B's (Rafiq) ride with 403 Forbidden", async () => {
    const mockRafiqRide = {
      id: rideOfRafiqId,
      passengerId: userRafiq, // Owned by Rafiq
      stage: 'REQUESTED',
      seats: 1,
      poolId: null,
      pool: null,
    };

    // Simulate Prisma interactive transaction
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const tx = {
        rideRequest: {
          findUnique: vi.fn().mockResolvedValue(mockRafiqRide),
          update: vi.fn(),
          delete: vi.fn(),
        },
        pool: {
          update: vi.fn(),
        },
      };
      return callback(tx);
    });

    // Nusrat attempts to cancel Rafiq's ride
    await expect(cancelRide(userNusrat, rideOfRafiqId)).rejects.toThrow(
      'Unauthorized to cancel this ride'
    );

    // Verify it is a RideError with status 403
    try {
      await cancelRide(userNusrat, rideOfRafiqId);
      expect.fail('Should have thrown RideError');
    } catch (err) {
      expect(err).toBeInstanceOf(RideError);
      const rideErr = err as RideError;
      expect(rideErr.statusCode).toBe(403);
      expect(rideErr.message).toBe('Unauthorized to cancel this ride');
    }
  });

  it('allows User B (Rafiq) to cancel their own ride when in REQUESTED stage', async () => {
    const mockRafiqRide = {
      id: rideOfRafiqId,
      passengerId: userRafiq,
      stage: 'REQUESTED',
      seats: 1,
      poolId: null,
      pool: null,
    };

    const updatedRafiqRide = {
      ...mockRafiqRide,
      stage: 'CANCELLED',
    };

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const tx = {
        rideRequest: {
          findUnique: vi.fn().mockResolvedValue(mockRafiqRide),
          update: vi.fn().mockResolvedValue(updatedRafiqRide),
          delete: vi.fn().mockResolvedValue(mockRafiqRide),
        },
        pool: {
          update: vi.fn(),
        },
      };
      return callback(tx);
    });

    const result = await cancelRide(userRafiq, rideOfRafiqId);
    expect(result).toBeDefined();
    expect(result.stage).toBe('CANCELLED');
  });

  it('throws 404 if the ride does not exist', async () => {
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const tx = {
        rideRequest: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      return callback(tx);
    });

    try {
      await cancelRide(userRafiq, 'non-existent-id');
      expect.fail('Should have thrown 404');
    } catch (err) {
      expect(err).toBeInstanceOf(RideError);
      expect((err as RideError).statusCode).toBe(404);
      expect((err as RideError).message).toBe('Ride request not found');
    }
  });

  it('prevents cancellation if a driver has already accepted the ride (MATCHED)', async () => {
    const mockAcceptedRide = {
      id: rideOfRafiqId,
      passengerId: userRafiq,
      stage: 'MATCHED',
      seats: 1,
      poolId: 'pool-1',
      pool: {
        id: 'pool-1',
        stage: 'MATCHED',
        teslaId: 'tesla-bullet-id',
      },
    };

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const tx = {
        rideRequest: {
          findUnique: vi.fn().mockResolvedValue(mockAcceptedRide),
        },
      };
      return callback(tx);
    });

    try {
      await cancelRide(userRafiq, rideOfRafiqId);
      expect.fail('Should have thrown 400');
    } catch (err) {
      expect(err).toBeInstanceOf(RideError);
      expect((err as RideError).statusCode).toBe(400);
      expect((err as RideError).message).toContain('Cannot cancel ride: A driver has already accepted your ride');
    }
  });
});
