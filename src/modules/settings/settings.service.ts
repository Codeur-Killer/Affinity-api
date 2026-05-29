import { prisma } from '../../config/prisma';
import { UserSettings } from '@prisma/client';

export async function getSettings(userId: string): Promise<UserSettings> {
  return prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function updateSettings(
  userId: string,
  data: Partial<Omit<UserSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<UserSettings> {
  return prisma.userSettings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

export async function updateFcmToken(userId: string, fcmToken: string): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    update: { fcmToken },
    create: { userId, fcmToken },
  });
}
