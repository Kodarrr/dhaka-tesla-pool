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
        upsert: vi.fn(),
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
    (prisma.user.findUnique as any).mockResolvedValue({ id: driverId, name: 'Jashim' });
    (prisma.tesla.upsert as any).mockResolvedValue({
      id: 'tesla-bullet',
      name: 'Bullet',
      plate: 'DHA-M-1',
      capacity: 3,
      isOnline: true,
    });

    const tesla = await getDriverTesla(driverId);
    expect(tesla).toBeDefined();
    expect(tesla.isOnline).toBe(true);
    expect(prisma.tesla.upsert).toHaveBeenCalled();
  });

  it('auto-provisions a Tesla if a newly registered driver does not have one yet', async () => {
    const newDriverId = 'driver-new-user-abc';
    (prisma.user.findUnique as any).mockResolvedValue({ id: newDriverId, name: 'New Driver' });
    (prisma.tesla.upsert as any).mockResolvedValue({
      id: 'tesla-new',
      name: "New Driver's Tesla",
      plate: 'DHA-RABC',
      capacity: 3,
      isOnline: false,
    });

    const tesla = await getDriverTesla(newDriverId);
    expect(tesla).toBeDefined();
    expect(tesla.name).toBe("New Driver's Tesla");
    expect(prisma.tesla.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { driverId: newDriverId } })
    );
  });

  it('updates driver online status to false (offline)', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: driverId, name: 'Jashim' });
    (prisma.tesla.findUnique as any).mockResolvedValue({
      id: 'tesla-bullet',
      driverId,
      isOnline: true,
    });
    (prisma.tesla.upsert as any).mockResolvedValue({
      id: 'tesla-bullet',
      name: 'Bullet',
      plate: 'DHA-M-1',
      capacity: 3,
      isOnline: false,
    });

    const result = await setDriverOnlineStatus(driverId, false);
    expect(result.isOnline).toBe(false);
    expect(prisma.tesla.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { driverId },
        update: { isOnline: false },
      })
    );
  });

  it('toggles driver status from offline to online when isOnline parameter is omitted', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: driverId, name: 'Jashim' });
    (prisma.tesla.findUnique as any).mockResolvedValue({
      id: 'tesla-bullet',
      driverId,
      isOnline: false, // currently offline → should toggle to true
    });
    (prisma.tesla.upsert as any).mockResolvedValue({
      id: 'tesla-bullet',
      name: 'Bullet',
      plate: 'DHA-M-1',
      capacity: 3,
      isOnline: true,
    });

    const result = await setDriverOnlineStatus(driverId); // no isOnline param → toggle
    expect(result.isOnline).toBe(true);
    expect(prisma.tesla.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { driverId },
        update: { isOnline: true },
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

