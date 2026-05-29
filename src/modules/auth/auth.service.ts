import { prisma } from '../../config/prisma';
import { getFirebaseAuth } from '../../config/firebase';
import { signToken } from '../../utils/jwt';
import { User } from '@prisma/client';

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

  return { token, user, isNewUser, profileComplete };
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await getFirebaseAuth().deleteUser(user.firebaseUid).catch(() => {});
  await prisma.user.delete({ where: { id: userId } });
}
