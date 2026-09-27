import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import {
  getDriverTesla,
  setDriverOnlineStatus,
  acceptPool,
  DriverError,
} from '../driver.service.js';

vi.mock('../../../lib/prisma.js', () => {
  return {
    prisma: {
      tesla: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      pool: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      rideRequest: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

describe('Driver Online/Offline Status Management', () => {
  const driverId = 'driver-jashim-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches existing driver tesla online status', async () => {
    (prisma.tesla.findUnique as any).mockResolvedValue({
      id: 'tesla-bullet',
      name: 'Bullet',
      plate: 'DHA-3021',
      capacity: 3,
      isOnline: true,
    });

    const tesla = await getDriverTesla(driverId);
    expect(tesla).toBeDefined();
    expect(tesla.isOnline).toBe(true);
    expect(tesla.plate).toBe('DHA-3021');
  });

  it('auto-provisions a Tesla if a newly registered driver does not have one yet', async () => {
    (prisma.tesla.findUnique as any).mockResolvedValue(null);
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'driver-new',
      name: 'New Driver',
    });
    (prisma.tesla.create as any).mockResolvedValue({
      id: 'tesla-new',
      name: "New Driver's Tesla",
      plate: 'DHA-5555',
      capacity: 3,
      isOnline: true,
    });

    const tesla = await getDriverTesla('driver-new');
    expect(tesla).toBeDefined();
    expect(tesla.name).toBe("New Driver's Tesla");
    expect(prisma.tesla.create).toHaveBeenCalled();
  });

  it('updates driver online status to false (offline)', async () => {
    (prisma.tesla.findUnique as any).mockResolvedValue({
      id: 'tesla-bullet',
      driverId,
      isOnline: true,
    });
    (prisma.tesla.update as any).mockResolvedValue({
      id: 'tesla-bullet',
      name: 'Bullet',
      plate: 'DHA-3021',
      capacity: 3,
      isOnline: false,
    });

    const result = await setDriverOnlineStatus(driverId, false);
    expect(result.isOnline).toBe(false);
    expect(prisma.tesla.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tesla-bullet' },
        data: { isOnline: false },
      })
    );
  });

  it('toggles driver status from offline to online when isOnline parameter is omitted', async () => {
    (prisma.tesla.findUnique as any).mockResolvedValue({
      id: 'tesla-bullet',
      driverId,
      isOnline: false,
    });
    (prisma.tesla.update as any).mockResolvedValue({
      id: 'tesla-bullet',
      name: 'Bullet',
      plate: 'DHA-3021',
      capacity: 3,
      isOnline: true,
    });

    const result = await setDriverOnlineStatus(driverId);
    expect(result.isOnline).toBe(true);
    expect(prisma.tesla.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tesla-bullet' },
        data: { isOnline: true },
      })
    );
  });

  it('prevents offline driver from accepting a pool with 400 Bad Request', async () => {
    (prisma.tesla.findUnique as any).mockResolvedValue({
      id: 'tesla-bullet',
      driverId,
      name: 'Bullet',
      isOnline: false, // DRIVER IS OFFLINE
      driver: { name: 'Jashim' },
    });

    await expect(acceptPool(driverId, 'pool-1')).rejects.toThrow(
      'Driver is offline. Toggle status to Online to accept rides.'
    );

    try {
      await acceptPool(driverId, 'pool-1');
      expect.fail('Should have thrown 400');
    } catch (err) {
      expect(err).toBeInstanceOf(DriverError);
      expect((err as DriverError).statusCode).toBe(400);
    }
  });

  it('allows online driver to accept pool successfully', async () => {
    (prisma.tesla.findUnique as any).mockResolvedValue({
      id: 'tesla-bullet',
      driverId,
      name: 'Bullet',
      isOnline: true, // DRIVER IS ONLINE
      driver: { name: 'Jashim' },
    });

    (prisma.pool.findUnique as any).mockResolvedValue({
      id: 'pool-1',
      stage: 'REQUESTED',
    });

    const mockUpdatedPool = {
      id: 'pool-1',
      stage: 'MATCHED',
      teslaId: 'tesla-bullet',
      rideRequests: [],
      tesla: { driver: { id: driverId, name: 'Jashim' } },
    };

    (prisma.$transaction as any).mockResolvedValue([mockUpdatedPool]);

    const result = await acceptPool(driverId, 'pool-1');
    expect(result).toBeDefined();
    expect(result.stage).toBe('MATCHED');
  });
});

