import { prisma } from '../../lib/prisma.js';

export async function getNotifications(userId: string, unreadOnly = false) {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return { notifications };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const n = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!n || n.userId !== userId) return null;
  return prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  return { success: true };
}

// Helper to create a notification (used by other services)
export async function createNotification(data: {
  userId: string;
  type: string;
  message: string;
  rideRequestId?: string;
  poolId?: string;
}) {
  return prisma.notification.create({ data });
}
