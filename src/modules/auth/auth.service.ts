import { prisma } from '../../config/prisma';
import { getFirebaseAuth } from '../../config/firebase';
import { signToken } from '../../utils/jwt';
import { User } from '@prisma/client';
import { sendFirestorePushNotification } from '../../utils/firestore';

interface SyncResult {
  token: string;
  user: User;
  isNewUser: boolean;
  profileComplete: boolean;
}

export async function syncFirebaseUser(
  firebaseToken: string,
  fcmToken?: string,
): Promise<SyncResult> {
  const decoded = await getFirebaseAuth().verifyIdToken(firebaseToken);

  const { uid, email, phone_number: phone } = decoded;

  let isNewUser = false;

  let user = await prisma.user.findUnique({
    where: { firebaseUid: uid },
    include: { profile: true, settings: true },
  });

  if (!user) {
    isNewUser = true;
    user = await prisma.user.create({
      data: {
        firebaseUid: uid,
        email: email ?? null,
        phone: phone ?? null,
        provider: decoded.firebase.sign_in_provider ?? 'email',
        settings: {
          create: {},
        },
      },
      include: { profile: true, settings: true },
    });
  }

  if (fcmToken && user.settings) {
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: { fcmToken },
    });
  } else if (fcmToken) {
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: { fcmToken },
      create: { userId: user.id, fcmToken },
    });
  }

  const token = signToken({
    userId: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
  });

  const profileComplete = !!(user as User & { profile: unknown }).profile;

  // Mise à jour de lastSeenAt + vérification expiration abonnement (fire-and-forget)
  if (profileComplete) {
    Promise.resolve().then(async () => {
      try {
        await prisma.profile.updateMany({
          where: { userId: user.id },
          data:  { lastSeenAt: new Date() },
        });

        // Notifier si l'abonnement expire dans ≤ 3 jours (une fois par jour max)
        const sub = await prisma.subscription.findUnique({
          where: { userId: user.id },
        });
        if (sub && sub.fedapayStatus === 'approved' && sub.expiresAt > new Date()) {
          const daysLeft = (sub.expiresAt.getTime() - Date.now()) / 86_400_000;
          if (daysLeft <= 3) {
            const oneDayAgo = new Date(Date.now() - 86_400_000);
            const alreadyNotified = await prisma.notification.count({
              where: {
                userId:    user.id,
                type:      'SYSTEM',
                title:     { contains: 'expire' },
                createdAt: { gte: oneDayAgo },
              },
            });
            if (alreadyNotified === 0) {
              const daysLabel = Math.ceil(daysLeft) === 1 ? 'demain' : `dans ${Math.ceil(daysLeft)} jours`;
              await prisma.notification.create({
                data: {
                  userId: user.id,
                  type:   'SYSTEM',
                  title:  `⏰ Votre abonnement expire ${daysLabel}`,
                  body:   'Renouvelez pour continuer à swiper sans interruption.',
                  data:   { type: 'SUBSCRIPTION_EXPIRY' },
                },
              });
              const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
              if (settings?.fcmToken) {
                sendFirestorePushNotification(
                  settings.fcmToken,
                  `⏰ Votre abonnement expire ${daysLabel}`,
                  'Renouvelez pour continuer à swiper sans interruption.',
                  { type: 'SUBSCRIPTION_EXPIRY' },
                ).catch(() => {});
              }
            }
          }
        }
      } catch { /* non critique */ }
    }).catch(() => {});
  }

  return { token, user, isNewUser, profileComplete };
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await getFirebaseAuth().deleteUser(user.firebaseUid).catch(() => {});
  await prisma.user.delete({ where: { id: userId } });
}
