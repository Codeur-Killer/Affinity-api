import { prisma } from '../../config/prisma';
import { Profile } from '@prisma/client';
import { createFirestoreConversation, sendFirestorePushNotification } from '../../utils/firestore';

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
  return a.filter((x) => b.includes(x)).length / Math.max(a.length, b.length);
}

export async function getCandidates(userId: string): Promise<Profile[]> {
  const [myProfile, settings] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);
  if (!myProfile) return [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [alreadyLiked, alreadyPassed, blocked] = await Promise.all([
    prisma.like.findMany({ where: { senderId: userId }, select: { receiverId: true } }),
    prisma.pass.findMany({ where: { passerId: userId }, select: { passedId: true } }),
    prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  const excludedIds = new Set([
    userId,
    ...alreadyLiked.map((l) => l.receiverId),
    ...alreadyPassed.map((p) => p.passedId),
    ...blocked.flatMap((b) => [b.blockerId, b.blockedId]),
  ]);

  const genderFilter =
    settings?.genderPreference && settings.genderPreference !== 'ALL'
      ? { gender: settings.genderPreference as 'MALE' | 'FEMALE' | 'OTHER' }
      : undefined;

  const candidates = await prisma.profile.findMany({
    where: {
      userId:     { notIn: Array.from(excludedIds) },
      isActive:   true,
      lastSeenAt: { gte: sevenDaysAgo },
      ...genderFilter,
    },
    take: CANDIDATES_LIMIT * 3,
  });

  return candidates
    .map((c) => {
      let score = 0;
      if (myProfile.latitude && myProfile.longitude && c.latitude && c.longitude) {
        const dist = haversineKm(myProfile.latitude, myProfile.longitude, c.latitude, c.longitude);
        const max  = settings?.maxDistance ?? 100;
        if (dist <= max) score += (1 - dist / max) * 40;
      } else { score += 10; }
      score += interestScore(myProfile.interests, c.interests) * 30;
      if (myProfile.relationshipGoal === c.relationshipGoal) score += 20;
      const days = (Date.now() - c.lastSeenAt.getTime()) / 86400000;
      score += Math.max(0, (7 - days) / 7) * 10;
      return { profile: c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES_LIMIT)
    .map((x) => x.profile);
}

interface LikeResult { liked: boolean }

// ── Like : envoie une notification au destinataire (pas d'auto-match) ──────────
export async function likeUser(senderId: string, receiverId: string): Promise<LikeResult> {
  if (senderId === receiverId) throw new Error('Impossible de vous liker vous-même');

  const [senderProfile, receiver] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: senderId } }),
    prisma.user.findUnique({ where: { id: receiverId }, include: { settings: true } }),
  ]);
  if (!receiver) throw new Error('Utilisateur introuvable');

  await prisma.like.upsert({
    where:  { senderId_receiverId: { senderId, receiverId } },
    update: {},
    create: { senderId, receiverId },
  });
  await prisma.pass.deleteMany({ where: { passerId: senderId, passedId: receiverId } });

  const senderName = senderProfile?.firstName ?? 'Quelqu\'un';

  // Notification avec les IDs pour Accept/Reject dans l'app
  await prisma.notification.create({
    data: {
      userId: receiverId,
      type:   'LIKE',
      title:  `❤️ ${senderName} vous a aimé !`,
      body:   'Appuyez pour accepter ou refuser le match',
      data:   { senderId, senderName },
    },
  });

  // Push FCM
  if (receiver.settings?.fcmToken) {
    await sendFirestorePushNotification(
      receiver.settings.fcmToken,
      `❤️ ${senderName} vous a aimé !`,
      'Appuyez pour accepter ou refuser',
      { type: 'LIKE', senderId },
    ).catch(() => { /* non bloquant */ });
  }

  return { liked: true };
}

// ── Répondre à un like : accepter crée le match, refuser supprime le like ──────
export interface RespondResult {
  accepted:        boolean;
  isMatch:         boolean;
  matchId?:        string;
  conversationId?: string;
}

export async function respondToLike(
  responderId: string,  // celui qui répond
  likerId:     string,  // celui qui a aimé
  accept:      boolean,
): Promise<RespondResult> {
  const like = await prisma.like.findUnique({
    where: { senderId_receiverId: { senderId: likerId, receiverId: responderId } },
  });
  if (!like) throw new Error('Like introuvable ou déjà traité');

  if (!accept) {
    await prisma.like.delete({ where: { id: like.id } });
    return { accepted: false, isMatch: false };
  }

  // Créer le match
  const existingMatch = await prisma.match.findFirst({
    where: {
      OR: [
        { user1Id: likerId, user2Id: responderId },
        { user1Id: responderId, user2Id: likerId },
      ],
    },
  });

  if (existingMatch) {
    return {
      accepted:       true,
      isMatch:        true,
      matchId:        existingMatch.id,
      conversationId: existingMatch.conversationId ?? undefined,
    };
  }

  const match = await prisma.match.create({
    data: { user1Id: likerId, user2Id: responderId },
  });

  let conversationId: string | undefined;
  try {
    conversationId = await createFirestoreConversation(match.id, likerId, responderId);
    await prisma.match.update({ where: { id: match.id }, data: { conversationId } });
  } catch { /* Firestore optionnel */ }

  // Notifier les deux
  const [respProfile, likerProfile] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: responderId } }),
    prisma.profile.findUnique({ where: { userId: likerId } }),
  ]);
  const respName  = respProfile?.firstName  ?? 'Votre match';
  const likerName = likerProfile?.firstName ?? 'Quelqu\'un';

  await Promise.all([
    prisma.notification.create({
      data: {
        userId: likerId,
        type:   'MATCH',
        title:  `🎉 ${respName} a accepté votre like !`,
        body:   'C\'est un match ! Démarrez la conversation.',
        data:   { matchId: match.id, conversationId },
      },
    }),
    prisma.notification.create({
      data: {
        userId: responderId,
        type:   'MATCH',
        title:  `🎉 Match avec ${likerName} !`,
        body:   'Démarrez la conversation maintenant.',
        data:   { matchId: match.id, conversationId },
      },
    }),
  ]);

  // FCM push au liker
  const liker = await prisma.user.findUnique({
    where: { id: likerId }, include: { settings: true },
  });
  if (liker?.settings?.fcmToken) {
    await sendFirestorePushNotification(
      liker.settings.fcmToken,
      `🎉 ${respName} a accepté votre like !`,
      'C\'est un match !',
      { type: 'MATCH', matchId: match.id },
    ).catch(() => {});
  }

  return { accepted: true, isMatch: true, matchId: match.id, conversationId };
}

export async function passUser(passerId: string, passedId: string): Promise<void> {
  if (passerId === passedId) return;
  await prisma.pass.upsert({
    where:  { passerId_passedId: { passerId, passedId } },
    update: {},
    create: { passerId, passedId },
  });
}
