import { prisma } from '../../config/prisma';
import { Profile } from '@prisma/client';
import { createFirestoreConversation } from '../../utils/firestore';
import { sendFirestorePushNotification } from '../../utils/firestore';

const CANDIDATES_LIMIT = 20;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interestScore(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const common = a.filter((x) => b.includes(x)).length;
  return common / Math.max(a.length, b.length);
}

export async function getCandidates(userId: string): Promise<Profile[]> {
  const myProfile = await prisma.profile.findUnique({ where: { userId } });
  const settings = await prisma.userSettings.findUnique({ where: { userId } });

  if (!myProfile) return [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const alreadySeenLikes = await prisma.like.findMany({
    where: { senderId: userId },
    select: { receiverId: true },
  });
  const alreadySeenPasses = await prisma.pass.findMany({
    where: { passerId: userId },
    select: { passedId: true },
  });
  const blockedUsers = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });

  const excludedIds = new Set([
    userId,
    ...alreadySeenLikes.map((l) => l.receiverId),
    ...alreadySeenPasses.map((p) => p.passedId),
    ...blockedUsers.flatMap((b) => [b.blockerId, b.blockedId]),
  ]);

  const genderFilter = settings?.genderPreference
    ? settings.genderPreference === 'ALL'
      ? undefined
      : { gender: settings.genderPreference as 'MALE' | 'FEMALE' | 'OTHER' }
    : undefined;

  const candidates = await prisma.profile.findMany({
    where: {
      userId: { notIn: Array.from(excludedIds) },
      isActive: true,
      lastSeenAt: { gte: sevenDaysAgo },
      ...genderFilter,
    },
    take: CANDIDATES_LIMIT * 3,
  });

  const scored = candidates
    .map((c) => {
      let score = 0;

      if (myProfile.latitude && myProfile.longitude && c.latitude && c.longitude) {
        const distKm = haversineKm(myProfile.latitude, myProfile.longitude, c.latitude, c.longitude);
        const maxDist = settings?.maxDistance ?? 100;
        if (distKm <= maxDist) score += (1 - distKm / maxDist) * 40;
      } else {
        score += 10;
      }

      score += interestScore(myProfile.interests, c.interests) * 30;

      if (myProfile.relationshipGoal === c.relationshipGoal) score += 20;

      const daysSinceSeen = (Date.now() - c.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, (7 - daysSinceSeen) / 7) * 10;

      return { profile: c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES_LIMIT)
    .map((x) => x.profile);

  return scored;
}

interface LikeResult {
  isMatch: boolean;
  matchId?: string;
  conversationId?: string;
}

export async function likeUser(senderId: string, receiverId: string): Promise<LikeResult> {
  if (senderId === receiverId) throw new Error('Vous ne pouvez pas vous liker vous-même');

  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    include: { settings: true },
  });
  if (!receiver) throw new Error('Utilisateur introuvable');

  await prisma.like.upsert({
    where: { senderId_receiverId: { senderId, receiverId } },
    update: {},
    create: { senderId, receiverId },
  });

  await prisma.pass.deleteMany({
    where: { passerId: senderId, passedId: receiverId },
  });

  const mutualLike = await prisma.like.findUnique({
    where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } },
  });

  if (!mutualLike) {
    await createNotification(receiverId, 'LIKE', '❤️ Quelqu\'un vous a liké !', 'Découvrez qui s\'intéresse à vous');
    if (receiver.settings?.fcmToken) {
      await sendFirestorePushNotification(
        receiver.settings.fcmToken,
        '❤️ Nouveau like !',
        'Quelqu\'un vous a liké sur Affinity',
        { type: 'LIKE' },
      );
    }
    return { isMatch: false };
  }

  const existingMatch = await prisma.match.findFirst({
    where: {
      OR: [
        { user1Id: senderId, user2Id: receiverId },
        { user1Id: receiverId, user2Id: senderId },
      ],
    },
  });

  if (existingMatch) {
    return {
      isMatch: true,
      matchId: existingMatch.id,
      conversationId: existingMatch.conversationId ?? undefined,
    };
  }

  const match = await prisma.match.create({
    data: { user1Id: senderId, user2Id: receiverId },
  });

  let conversationId: string | undefined;
  try {
    conversationId = await createFirestoreConversation(match.id, senderId, receiverId);
    await prisma.match.update({
      where: { id: match.id },
      data: { conversationId },
    });
  } catch {
    // Firestore non configuré — le match existe quand même
  }

  await createNotification(senderId, 'MATCH', '🎉 C\'est un match !', 'Vous avez un nouveau match');
  await createNotification(receiverId, 'MATCH', '🎉 C\'est un match !', 'Vous avez un nouveau match');

  if (receiver.settings?.fcmToken) {
    await sendFirestorePushNotification(
      receiver.settings.fcmToken,
      '🎉 Nouveau match !',
      'Vous avez un match sur Affinity ! Démarrez la conversation.',
      { type: 'MATCH', matchId: match.id },
    );
  }

  return { isMatch: true, matchId: match.id, conversationId };
}

export async function passUser(passerId: string, passedId: string): Promise<void> {
  if (passerId === passedId) return;
  await prisma.pass.upsert({
    where: { passerId_passedId: { passerId, passedId } },
    update: {},
    create: { passerId, passedId },
  });
}

async function createNotification(
  userId: string,
  type: 'MATCH' | 'LIKE' | 'MESSAGE' | 'VISIT' | 'SYSTEM',
  title: string,
  body: string,
): Promise<void> {
  await prisma.notification.create({ data: { userId, type, title, body } });
}
