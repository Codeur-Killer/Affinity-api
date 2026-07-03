"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCandidates = getCandidates;
exports.getReceivedLikes = getReceivedLikes;
exports.likeUser = likeUser;
exports.passUser = passUser;
const prisma_1 = require("../../config/prisma");
const firestore_1 = require("../../utils/firestore");
const plan_limits_1 = require("../subscription/plan-limits");
const CANDIDATES_LIMIT = 20;
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function interestScore(a, b) {
    if (!a.length || !b.length)
        return 0;
    return a.filter((x) => b.includes(x)).length / Math.max(a.length, b.length);
}
// ── Candidats pour le swipe ────────────────────────────────────────────────────
async function getCandidates(userId, filters = {}) {
    const [myProfile, settings] = await Promise.all([
        prisma_1.prisma.profile.findUnique({ where: { userId } }),
        prisma_1.prisma.userSettings.findUnique({ where: { userId } }),
    ]);
    if (!myProfile)
        return [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [alreadyLiked, receivedLikes, alreadyPassed, blocked] = await Promise.all([
        prisma_1.prisma.like.findMany({
            where: { senderId: userId },
            select: { receiverId: true },
        }),
        prisma_1.prisma.like.findMany({
            where: { receiverId: userId },
            select: { senderId: true },
        }),
        filters.reset
            ? Promise.resolve([])
            : prisma_1.prisma.pass.findMany({
                where: { passerId: userId },
                select: { passedId: true },
            }),
        prisma_1.prisma.block.findMany({
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
    const likedMeIds = new Set(receivedLikes.map((l) => l.senderId));
    const genderPref = filters.gender ?? settings?.genderPreference;
    const genderFilter = genderPref && genderPref !== 'ALL'
        ? { gender: genderPref }
        : undefined;
    const candidates = await prisma_1.prisma.profile.findMany({
        where: {
            userId: { notIn: Array.from(excludedIds) },
            isActive: true,
            incognito: false,
            lastSeenAt: { gte: thirtyDaysAgo },
            ...genderFilter,
        },
        take: CANDIDATES_LIMIT * 3,
    });
    // ── Profils secrets (Premium) : invisibles sauf s'ils m'ont déjà liké ───────
    const candidateIds = candidates.map((c) => c.userId);
    const [premiumSubs, activeBoosts] = await Promise.all([
        prisma_1.prisma.subscription.findMany({
            where: {
                userId: { in: candidateIds },
                plan: 'PREMIUM',
                fedapayStatus: 'approved',
                expiresAt: { gt: new Date() },
            },
            select: { userId: true },
        }),
        prisma_1.prisma.boost.findMany({
            where: { userId: { in: candidateIds }, expiresAt: { gt: new Date() } },
            select: { userId: true },
        }),
    ]);
    const secretProfileIds = new Set(premiumSubs.map((s) => s.userId).filter((id) => !likedMeIds.has(id)));
    const boostedIds = new Set(activeBoosts.map((b) => b.userId));
    return candidates
        .filter((c) => !secretProfileIds.has(c.userId))
        .map((c) => {
        let score = 0;
        if (myProfile.latitude && myProfile.longitude && c.latitude && c.longitude) {
            const maxDist = filters.maxDistance ?? settings?.maxDistance ?? 100;
            const dist = haversineKm(myProfile.latitude, myProfile.longitude, c.latitude, c.longitude);
            if (dist <= maxDist)
                score += (1 - dist / maxDist) * 40;
        }
        else {
            score += 10;
        }
        if (filters.neighborhood && filters.neighborhood !== 'Tous les quartiers') {
            if (c.neighborhood !== filters.neighborhood && c.city !== filters.neighborhood) {
                return { profile: c, score: -1 };
            }
        }
        score += interestScore(myProfile.interests, c.interests) * 30;
        if (myProfile.relationshipGoal === c.relationshipGoal)
            score += 20;
        const days = (Date.now() - c.lastSeenAt.getTime()) / 86400000;
        score += Math.max(0, (30 - days) / 30) * 10;
        if (boostedIds.has(c.userId))
            score += 1000;
        return { profile: c, score };
    })
        .filter((x) => x.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, CANDIDATES_LIMIT)
        .map((x) => x.profile);
}
// ── Likes reçus (profils qui m'ont liké sans que je les aie likés) ─────────────
async function getReceivedLikes(userId) {
    // Récupérer tous les likes reçus
    const received = await prisma_1.prisma.like.findMany({
        where: { receiverId: userId },
        include: { sender: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
    });
    // IDs des utilisateurs que j'ai déjà likés
    const iLiked = await prisma_1.prisma.like.findMany({
        where: { senderId: userId },
        select: { receiverId: true },
    });
    const iLikedSet = new Set(iLiked.map((l) => l.receiverId));
    // IDs de mes matchs déjà établis
    const myMatches = await prisma_1.prisma.match.findMany({
        where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
        select: { user1Id: true, user2Id: true },
    });
    const matchedIds = new Set(myMatches.flatMap((m) => [m.user1Id, m.user2Id]).filter((id) => id !== userId));
    return received
        .filter((l) => !iLikedSet.has(l.senderId) && !matchedIds.has(l.senderId))
        .filter((l) => l.sender.profile !== null)
        .map((l) => ({
        senderId: l.senderId,
        profile: l.sender.profile,
        likedAt: l.createdAt,
    }));
}
async function likeUser(senderId, receiverId, isSuperLike = false) {
    if (senderId === receiverId) {
        throw new Error('Impossible de vous liker vous-même');
    }
    const access = await (0, plan_limits_1.getAccessStatus)(senderId);
    if (!access.canSwipe) {
        throw new Error(!access.isActive
            ? 'Un abonnement actif est requis pour liker des profils'
            : 'Votre identité doit être vérifiée pour liker des profils');
    }
    if (isSuperLike) {
        if (access.limits.dailySuperLikes !== null
            && access.usage.superLikesToday >= access.limits.dailySuperLikes) {
            throw new Error('Limite quotidienne de Super Likes atteinte pour votre plan');
        }
    }
    else if (access.limits.dailyLikes !== null
        && access.usage.likesToday >= access.limits.dailyLikes) {
        throw new Error('Limite quotidienne de likes atteinte pour votre plan');
    }
    const [senderProfile, receiver] = await Promise.all([
        prisma_1.prisma.profile.findUnique({ where: { userId: senderId } }),
        prisma_1.prisma.user.findUnique({
            where: { id: receiverId },
            include: { settings: true },
        }),
    ]);
    if (!receiver)
        throw new Error('Utilisateur introuvable');
    // Enregistrer le like (idempotent)
    await prisma_1.prisma.like.upsert({
        where: { senderId_receiverId: { senderId, receiverId } },
        update: { isSuperLike },
        create: { senderId, receiverId, isSuperLike },
    });
    // Nettoyer un éventuel pass précédent
    await prisma_1.prisma.pass.deleteMany({
        where: { passerId: senderId, passedId: receiverId },
    });
    // ── Vérifier si c'est un like mutuel (B avait déjà liké A) ─────────────────
    const mutualLike = await prisma_1.prisma.like.findUnique({
        where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } },
    });
    if (mutualLike) {
        // Match déjà existant ?
        const existing = await prisma_1.prisma.match.findFirst({
            where: {
                OR: [
                    { user1Id: senderId, user2Id: receiverId },
                    { user1Id: receiverId, user2Id: senderId },
                ],
            },
        });
        if (existing) {
            return {
                liked: true,
                isMatch: true,
                matchId: existing.id,
                conversationId: existing.conversationId ?? undefined,
            };
        }
        // ── Créer le match ──────────────────────────────────────────────────────
        const match = await prisma_1.prisma.match.create({
            data: { user1Id: senderId, user2Id: receiverId },
        });
        let conversationId;
        try {
            // Utiliser les Firebase UIDs pour que les règles Firestore fonctionnent
            // (request.auth.uid dans Firestore = Firebase UID, pas le UUID PostgreSQL)
            const [u1, u2] = await Promise.all([
                prisma_1.prisma.user.findUnique({ where: { id: senderId }, select: { firebaseUid: true } }),
                prisma_1.prisma.user.findUnique({ where: { id: receiverId }, select: { firebaseUid: true } }),
            ]);
            const fbUid1 = u1?.firebaseUid ?? senderId;
            const fbUid2 = u2?.firebaseUid ?? receiverId;
            conversationId = await (0, firestore_1.createFirestoreConversation)(match.id, fbUid1, fbUid2);
            await prisma_1.prisma.match.update({
                where: { id: match.id },
                data: { conversationId },
            });
        }
        catch (e) {
            console.error('[Firestore] Erreur création conversation:', e);
        }
        const senderName = senderProfile?.firstName ?? 'Quelqu\'un';
        const receiverName = (await prisma_1.prisma.profile.findUnique({ where: { userId: receiverId } }))?.firstName ?? 'Votre match';
        // Notifier les deux utilisateurs
        await Promise.all([
            prisma_1.prisma.notification.create({
                data: {
                    userId: senderId,
                    type: 'MATCH',
                    title: `🎉 Match avec ${receiverName} !`,
                    body: 'C\'est un match ! Démarrez la conversation.',
                    data: { matchId: match.id, conversationId },
                },
            }),
            prisma_1.prisma.notification.create({
                data: {
                    userId: receiverId,
                    type: 'MATCH',
                    title: `🎉 Match avec ${senderName} !`,
                    body: 'C\'est un match ! Démarrez la conversation.',
                    data: { matchId: match.id, conversationId },
                },
            }),
        ]);
        // Push FCM aux deux
        const senderUser = await prisma_1.prisma.user.findUnique({
            where: { id: senderId },
            include: { settings: true },
        });
        const pushTargets = [
            { token: receiver.settings?.fcmToken, name: senderName },
            { token: senderUser?.settings?.fcmToken, name: receiverName },
        ];
        for (const { token, name } of pushTargets) {
            if (token) {
                (0, firestore_1.sendFirestorePushNotification)(token, '🎉 C\'est un match !', `Vous avez matché avec ${name}`, { type: 'MATCH', matchId: match.id }).catch(() => { });
            }
        }
        return { liked: true, isMatch: true, matchId: match.id, conversationId };
    }
    // ── Pas encore de like mutuel → envoyer notification à B ────────────────────
    const senderName = senderProfile?.firstName ?? 'Quelqu\'un';
    await prisma_1.prisma.notification.create({
        data: {
            userId: receiverId,
            type: 'LIKE',
            title: `❤️ ${senderName} vous a aimé !`,
            body: 'Likez en retour pour créer un match',
            data: { senderId, senderName },
        },
    });
    if (receiver.settings?.fcmToken) {
        (0, firestore_1.sendFirestorePushNotification)(receiver.settings.fcmToken, `❤️ ${senderName} vous a aimé !`, 'Likez en retour pour créer un match', { type: 'LIKE', senderId }).catch(() => { });
    }
    return { liked: true, isMatch: false };
}
// ── Pass ───────────────────────────────────────────────────────────────────────
async function passUser(passerId, passedId) {
    if (passerId === passedId)
        return;
    const access = await (0, plan_limits_1.getAccessStatus)(passerId);
    if (!access.canSwipe) {
        throw new Error(!access.isActive
            ? 'Un abonnement actif est requis pour passer des profils'
            : 'Votre identité doit être vérifiée pour passer des profils');
    }
    await prisma_1.prisma.pass.upsert({
        where: { passerId_passedId: { passerId, passedId } },
        update: {},
        create: { passerId, passedId },
    });
}
//# sourceMappingURL=discovery.service.js.map