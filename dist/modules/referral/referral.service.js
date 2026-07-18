"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReferralCode = buildReferralCode;
exports.useReferralCode = useReferralCode;
exports.getReferralStats = getReferralStats;
const prisma_1 = require("../../config/prisma");
// Code parrainage : AFFINITY- + 8 premiers chars de userId en majuscules
function buildReferralCode(userId) {
    return `AFFINITY-${userId.substring(0, 8).toUpperCase()}`;
}
// Retrouver l'auteur d'un code
async function findReferrer(code) {
    const prefix = code.toUpperCase().replace('AFFINITY-', '');
    const users = await prisma_1.prisma.user.findMany({ select: { id: true } });
    const match = users.find((u) => u.id.substring(0, 8).toUpperCase() === prefix);
    return match?.id ?? null;
}
async function useReferralCode(referredUserId, code) {
    // Un utilisateur ne peut être parrainé qu'une fois
    const existing = await prisma_1.prisma.referral.findUnique({
        where: { referredUserId },
    });
    if (existing)
        return { success: false, message: 'Vous avez déjà utilisé un code.' };
    const referrerId = await findReferrer(code);
    if (!referrerId)
        return { success: false, message: 'Code invalide.' };
    if (referrerId === referredUserId)
        return { success: false, message: 'Vous ne pouvez pas utiliser votre propre code.' };
    await prisma_1.prisma.referral.create({
        data: { referrerId, referredUserId, rewardAmount: 1500 },
    });
    return { success: true, message: 'Code appliqué ! Votre parrain recevra 1 500 FCFA.' };
}
async function getReferralStats(userId) {
    const referrals = await prisma_1.prisma.referral.findMany({
        where: { referrerId: userId },
    });
    return {
        code: buildReferralCode(userId),
        count: referrals.length,
        gains: referrals.reduce((sum, r) => sum + r.rewardAmount, 0),
    };
}
//# sourceMappingURL=referral.service.js.map