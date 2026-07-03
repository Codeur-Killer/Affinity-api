"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_LIMITS = void 0;
exports.getAccessStatus = getAccessStatus;
const prisma_1 = require("../../config/prisma");
const subscription_service_1 = require("./subscription.service");
exports.PLAN_LIMITS = {
    DECOUVERTE: {
        dailyLikes: 25,
        dailySuperLikes: 0,
        boostsPerMonth: 0,
        canSeeWhoLikedYou: true,
        canUseIncognito: false,
        advancedFilters: false,
        secretProfile: false,
        prioritySupport: false,
    },
    STANDARD: {
        dailyLikes: null,
        dailySuperLikes: 5,
        boostsPerMonth: 1,
        canSeeWhoLikedYou: true,
        canUseIncognito: true,
        advancedFilters: true,
        secretProfile: false,
        prioritySupport: false,
    },
    PREMIUM: {
        dailyLikes: null,
        dailySuperLikes: null,
        boostsPerMonth: null,
        canSeeWhoLikedYou: true,
        canUseIncognito: true,
        advancedFilters: true,
        secretProfile: true,
        prioritySupport: true,
    },
};
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
function startOfMonth() {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}
const NO_PLAN_LIMITS = {
    dailyLikes: 0,
    dailySuperLikes: 0,
    boostsPerMonth: 0,
    canSeeWhoLikedYou: false,
    canUseIncognito: false,
    advancedFilters: false,
    secretProfile: false,
    prioritySupport: false,
};
async function getAccessStatus(userId) {
    const [sub, profile, likesToday, superLikesToday, boostsThisMonth] = await Promise.all([
        (0, subscription_service_1.getCurrentSubscription)(userId),
        prisma_1.prisma.profile.findUnique({ where: { userId }, select: { isVerified: true } }),
        prisma_1.prisma.like.count({
            where: { senderId: userId, isSuperLike: false, createdAt: { gte: startOfToday() } },
        }),
        prisma_1.prisma.like.count({
            where: { senderId: userId, isSuperLike: true, createdAt: { gte: startOfToday() } },
        }),
        prisma_1.prisma.boost.count({
            where: { userId, startedAt: { gte: startOfMonth() } },
        }),
    ]);
    const isActive = sub ? sub.expiresAt > new Date() && sub.fedapayStatus === 'approved' : false;
    const isVerified = profile?.isVerified ?? false;
    const limits = isActive && sub ? exports.PLAN_LIMITS[sub.plan] : NO_PLAN_LIMITS;
    return {
        plan: isActive ? (sub?.plan ?? null) : null,
        isActive,
        isVerified,
        canSwipe: isActive && isVerified,
        limits,
        usage: { likesToday, superLikesToday, boostsThisMonth },
    };
}
//# sourceMappingURL=plan-limits.js.map