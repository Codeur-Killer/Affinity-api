import { prisma } from '../../config/prisma';

const PAGE_SIZE = 20;

export async function getNotifications(userId: string, page = 1) {
  const skip = (page - 1) * PAGE_SIZE;
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);
  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  return { notifications, total, page, unreadCount };
}

export async function markOneRead(notifId: string, userId: string): Promise<boolean> {
  const notif = await prisma.notification.findFirst({
    where: { id: notifId, userId },
  });
  if (!notif) return false;
  await prisma.notification.update({
    where: { id: notifId },
    data: { readAt: new Date() },
  });
  return true;
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
