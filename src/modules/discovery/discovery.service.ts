import { prisma } from '../../config/prisma';
import { Profile } from '@prisma/client';
import {
  createFirestoreConversation,
  sendFirestorePushNotification,
} from '../../utils/firestore';
import { getAccessStatus, invalidateAccessCache } from '../subscription/plan-limits';

const CANDIDATES_LIMIT = 20;

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R    = 6371;
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

export interface CandidateFilters {
  reset?:        boolean;
  gender?:       string;
  minAge?:       number;
  maxAge?:       number;
  maxDistance?:  number;
  neighborhood?: string;
}

// ── Candidats pour le swipe ────────────────────────────────────────────────────
export async function getCandidates(
  userId:  string,
  filters: CandidateFilters = {},
): Promise<Profile[]> {
  const [myProfile, settings] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);
  if (!myProfile) return [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [alreadyLiked, receivedLikes, alreadyPassed, blocked] = await Promise.all([
    prisma.like.findMany({
      where:  { senderId: userId },
      select: { receiverId: true },
    }),
    prisma.like.findMany({
      where:  { receiverId: userId },
      select: { senderId: true },
    }),
    filters.reset
      ? Promise.resolve([])
      : prisma.pass.findMany({
          where:  { passerId: userId },
          select: { passedId: true },
        }),
    prisma.block.findMany({
      where:  { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  const excludedIds = new Set([
    userId,
    ...alreadyLiked.map((l) => l.receiverId),
    ...alreadyPassed.map((p) => p.passedId),
    ...blocked.flatMap((b) => [b.blockerId, b.blockedId]),
  ]);
  const likedMeIds = new Set(receivedLikes.map((l) => l.senderId));

  const genderPref = filters.gender ?? settings?.genderPreference;
  const genderFilter =
    genderPref && genderPref !== 'ALL'
      ? { gender: genderPref as 'MALE' | 'FEMALE' | 'OTHER' }
      : undefined;

  // Filtre par tranche d'âge (minAge/maxAge → birthdate)
  const now = new Date();
  const birthdateFilter: Record<string, Date> = {};
  if (filters.maxAge) {
    birthdateFilter['gte'] = new Date(now.getFullYear() - filters.maxAge, now.getMonth(), now.getDate());
  }
  if (filters.minAge) {
    birthdateFilter['lte'] = new Date(now.getFullYear() - filters.minAge, now.getMonth(), now.getDate());
  }

  const candidates = await prisma.profile.findMany({
    where: {
      userId:     { notIn: Array.from(excludedIds) },
      isActive:   true,
      incognito:  false,
      lastSeenAt: { gte: thirtyDaysAgo },
      ...genderFilter,
      ...(Object.keys(birthdateFilter).length > 0 && { birthdate: birthdateFilter }),
    },
    take: CANDIDATES_LIMIT * 3,
  });

  // ── Profils secrets (Premium) : invisibles sauf s'ils m'ont déjà liké ───────
  const candidateIds = candidates.map((c) => c.userId);
  const [premiumSubs, activeBoosts] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        userId:        { in: candidateIds },
        plan:          'PREMIUM',
        fedapayStatus: 'approved',
        expiresAt:     { gt: new Date() },
      },
      select: { userId: true },
    }),
    prisma.boost.findMany({
      where: { userId: { in: candidateIds }, expiresAt: { gt: new Date() } },
      select: { userId: true },
    }),
  ]);
  const secretProfileIds = new Set(
    premiumSubs.map((s) => s.userId).filter((id) => !likedMeIds.has(id)),
  );
  const boostedIds = new Set(activeBoosts.map((b) => b.userId));

  return candidates
    .filter((c) => !secretProfileIds.has(c.userId))
    .map((c) => {
      let score = 0;

      if (myProfile.latitude && myProfile.longitude && c.latitude && c.longitude) {
        const maxDist = filters.maxDistance ?? settings?.maxDistance ?? 100;
        const dist    = haversineKm(
          myProfile.latitude, myProfile.longitude, c.latitude, c.longitude,
        );
        if (dist <= maxDist) score += (1 - dist / maxDist) * 40;
      } else {
        score += 10;
      }

      if (filters.neighborhood && filters.neighborhood !== 'Tous les quartiers') {
        if (c.neighborhood !== filters.neighborhood && c.city !== filters.neighborhood) {
          return { profile: c, score: -1 };
        }
      }

      score += interestScore(myProfile.interests, c.interests) * 30;
      if (myProfile.relationshipGoal === c.relationshipGoal) score += 20;
      const days = (Date.now() - c.lastSeenAt.getTime()) / 86400000;
      score += Math.max(0, (30 - days) / 30) * 10;
      if (boostedIds.has(c.userId)) score += 1000;

      return { profile: c, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES_LIMIT)
    .map((x) => x.profile);
}

// ── Likes reçus (profils qui m'ont liké sans que je les aie likés) ─────────────
export async function getReceivedLikes(userId: string): Promise<{
  senderId: string;
  profile:  Profile;
  likedAt:  Date;
}[]> {
  // Récupérer tous les likes reçus
  const received = await prisma.like.findMany({
    where:   { receiverId: userId },
    include: { sender: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // IDs des utilisateurs que j'ai déjà likés
  const iLiked = await prisma.like.findMany({
    where:  { senderId: userId },
    select: { receiverId: true },
  });
  const iLikedSet = new Set(iLiked.map((l) => l.receiverId));

  // IDs de mes matchs déjà établis
  const myMatches = await prisma.match.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    select: { user1Id: true, user2Id: true },
  });
  const matchedIds = new Set(
    myMatches.flatMap((m) => [m.user1Id, m.user2Id]).filter((id) => id !== userId),
  );

  return received
    .filter((l) => !iLikedSet.has(l.senderId) && !matchedIds.has(l.senderId))
    .filter((l) => l.sender.profile !== null)
    .map((l) => ({
      senderId: l.senderId,
      profile:  l.sender.profile!,
      likedAt:  l.createdAt,
    }));
}

// ── Like — cœur du système Tinder ────────────────────────────────────────────
// Flux :
//   A like B → notification à B (B voit A dans "likes reçus")
//   B like A → like mutuel détecté → match automatique
export interface LikeResult {
  liked:          boolean;
  isMatch:        boolean;
  matchId?:       string;
  conversationId?: string;
}

export async function likeUser(
  senderId:    string,
  receiverId:  string,
  isSuperLike: boolean = false,
): Promise<LikeResult> {
  if (senderId === receiverId) {
    throw new Error('Impossible de vous liker vous-même');
  }

  const access = await getAccessStatus(senderId);
  if (!access.canSwipe) {
    throw new Error(
      !access.isActive
        ? 'Un abonnement actif est requis pour liker des profils'
        : 'Votre identité doit être vérifiée pour liker des profils',
    );
  }
  if (isSuperLike) {
    if (access.limits.dailySuperLikes !== null
        && access.usage.superLikesToday >= access.limits.dailySuperLikes) {
      throw new Error('Limite quotidienne de Super Likes atteinte pour votre plan');
    }
  } else if (access.limits.dailyLikes !== null
      && access.usage.likesToday >= access.limits.dailyLikes) {
    throw new Error('Limite quotidienne de likes atteinte pour votre plan');
  }

  const [senderProfile, receiver] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: senderId } }),
    prisma.user.findUnique({
      where:   { id: receiverId },
      include: { settings: true },
    }),
  ]);
  if (!receiver) throw new Error('Utilisateur introuvable');

  // Enregistrer le like (idempotent)
  await prisma.like.upsert({
    where:  { senderId_receiverId: { senderId, receiverId } },
    update: { isSuperLike },
    create: { senderId, receiverId, isSuperLike },
  });
  // Nettoyer un éventuel pass précédent
  await prisma.pass.deleteMany({
    where: { passerId: senderId, passedId: receiverId },
  });

  // ── Vérifier si c'est un like mutuel (B avait déjà liké A) ─────────────────
  const mutualLike = await prisma.like.findUnique({
    where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } },
  });

  if (mutualLike) {
    // Match déjà existant ?
    const existing = await prisma.match.findFirst({
      where: {
        OR: [
          { user1Id: senderId, user2Id: receiverId },
          { user1Id: receiverId, user2Id: senderId },
        ],
      },
    });
    if (existing) {
      return {
        liked:          true,
        isMatch:        true,
        matchId:        existing.id,
        conversationId: existing.conversationId ?? undefined,
      };
    }

    // ── Créer le match ──────────────────────────────────────────────────────
    const match = await prisma.match.create({
      data: { user1Id: senderId, user2Id: receiverId },
    });

    // Invalider le cache d'accès (quota de likes a changé)
    invalidateAccessCache(senderId);

    const senderName   = senderProfile?.firstName ?? 'Quelqu\'un';
    const receiverName = (await prisma.profile.findUnique({ where: { userId: receiverId } }))?.firstName ?? 'Votre match';

    // Notifications en base (synchrones — légères)
    await Promise.all([
      prisma.notification.create({
        data: {
          userId: senderId,
          type:   'MATCH',
          title:  `🎉 Match avec ${receiverName} !`,
          body:   'C\'est un match ! Démarrez la conversation.',
          data:   { matchId: match.id },
        },
      }),
      prisma.notification.create({
        data: {
          userId: receiverId,
          type:   'MATCH',
          title:  `🎉 Match avec ${senderName} !`,
          body:   'C\'est un match ! Démarrez la conversation.',
          data:   { matchId: match.id },
        },
      }),
    ]);

    // Firestore + FCM en arrière-plan (fire-and-forget — ne bloque pas la réponse HTTP)
    Promise.resolve().then(async () => {
      try {
        const [u1, u2] = await Promise.all([
          prisma.user.findUnique({ where: { id: senderId },   select: { firebaseUid: true } }),
          prisma.user.findUnique({ where: { id: receiverId }, select: { firebaseUid: true } }),
        ]);
        const conversationId = await createFirestoreConversation(
          match.id,
          u1?.firebaseUid ?? senderId,
          u2?.firebaseUid ?? receiverId,
        );
        await prisma.match.update({ where: { id: match.id }, data: { conversationId } });
      } catch (e) {
        console.error('[Firestore] conversation:', e);
      }
      const senderUser = await prisma.user.findUnique({ where: { id: senderId }, include: { settings: true } });
      for (const [token, name] of [
        [receiver.settings?.fcmToken, senderName],
        [senderUser?.settings?.fcmToken, receiverName],
      ] as [string | undefined, string][]) {
        if (token) {
          sendFirestorePushNotification(token, '🎉 C\'est un match !', `Vous avez matché avec ${name}`, { type: 'MATCH', matchId: match.id }).catch(() => {});
        }
      }
    }).catch(() => {});

    return { liked: true, isMatch: true, matchId: match.id, conversationId: undefined };
  }

  // Invalider le cache (quota de likes a changé)
  invalidateAccessCache(senderId);

  // ── Pas encore de like mutuel → envoyer notification à B ────────────────────
  const senderName = senderProfile?.firstName ?? 'Quelqu\'un';

  await prisma.notification.create({
    data: {
      userId: receiverId,
      type:   'LIKE',
      title:  `❤️ ${senderName} vous a aimé !`,
      body:   'Likez en retour pour créer un match',
      data:   { senderId, senderName },
    },
  });

  if (receiver.settings?.fcmToken) {
    sendFirestorePushNotification(
      receiver.settings.fcmToken,
      `❤️ ${senderName} vous a aimé !`,
      'Likez en retour pour créer un match',
      { type: 'LIKE', senderId },
    ).catch(() => {});
  }

  return { liked: true, isMatch: false };
}

// ── Supprimer un pass (pour le bouton Undo) ───────────────────────────────────
export async function deletePass(passerId: string, passedId: string): Promise<void> {
  await prisma.pass.deleteMany({ where: { passerId, passedId } });
}

// ── Répondre à un like reçu ───────────────────────────────────────────────────
export async function respondToLike(
  userId:   string,
  likerId:  string,
  accept:   boolean,
): Promise<{ isMatch: boolean; matchId?: string }> {
  if (accept) {
    const result = await likeUser(userId, likerId);
    return { isMatch: result.isMatch, matchId: result.matchId };
  }
  // Refus → on passe le profil du likeur
  await prisma.pass.upsert({
    where:  { passerId_passedId: { passerId: userId, passedId: likerId } },
    update: {},
    create: { passerId: userId, passedId: likerId },
  });
  return { isMatch: false };
}

// ── Pass ───────────────────────────────────────────────────────────────────────
export async function passUser(
  passerId: string,
  passedId: string,
): Promise<void> {
  if (passerId === passedId) return;

  const access = await getAccessStatus(passerId);
  if (!access.canSwipe) {
    throw new Error(
      !access.isActive
        ? 'Un abonnement actif est requis pour passer des profils'
        : 'Votre identité doit être vérifiée pour passer des profils',
    );
  }

  await prisma.pass.upsert({
    where:  { passerId_passedId: { passerId, passedId } },
    update: {},
    create: { passerId, passedId },
  });
}
