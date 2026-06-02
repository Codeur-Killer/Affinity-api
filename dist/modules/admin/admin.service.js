"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = getStats;
exports.getUsers = getUsers;
exports.banUser = banUser;
exports.promoteUser = promoteUser;
exports.getPendingVerifications = getPendingVerifications;
exports.reviewVerification = reviewVerification;
exports.getSubscriptions = getSubscriptions;
exports.getRegistrationChart = getRegistrationChart;
const prisma_1 = require("../../config/prisma");
// ── Statistiques globales ──────────────────────────────────────────────────────
async function getStats() {
    const [totalUsers, activeUsers, totalProfiles, verifiedProfiles, pendingVerifications, totalMatches, activeSubscriptions, decouverte, standard, premium,] = await Promise.all([
        prisma_1.prisma.user.count(),
        prisma_1.prisma.profile.count({ where: { isActive: true } }),
        prisma_1.prisma.profile.count(),
        prisma_1.prisma.profile.count({ where: { isVerified: true } }),
        prisma_1.prisma.verification.count({ where: { status: 'PENDING' } }),
        prisma_1.prisma.match.count(),
        prisma_1.prisma.subscription.count({
            where: { fedapayStatus: 'approved', expiresAt: { gt: new Date() } },
        }),
        prisma_1.prisma.subscription.count({ where: { plan: 'DECOUVERTE', fedapayStatus: 'approved', expiresAt: { gt: new Date() } } }),
        prisma_1.prisma.subscription.count({ where: { plan: 'STANDARD', fedapayStatus: 'approved', expiresAt: { gt: new Date() } } }),
        prisma_1.prisma.subscription.count({ where: { plan: 'PREMIUM', fedapayStatus: 'approved', expiresAt: { gt: new Date() } } }),
    ]);
    const revenue = decouverte * 5000 + standard * 15000 + premium * 25000;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newUsersThisMonth = await prisma_1.prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
    });
    return {
        users: { total: totalUsers, active: activeUsers, newThisMonth: newUsersThisMonth },
        profiles: { total: totalProfiles, verified: verifiedProfiles, pendingVerification: pendingVerifications },
        matches: { total: totalMatches },
        subscriptions: { active: activeSubscriptions, decouverte, standard, premium },
        revenue: { total: revenue, fcfa: `${revenue.toLocaleString('fr-FR')} FCFA` },
    };
}
// ── Gestion des utilisateurs ───────────────────────────────────────────────────
async function getUsers(page = 1, limit = 20, search = '') {
    const skip = (page - 1) * limit;
    const where = search
        ? {
            OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { profile: { firstName: { contains: search, mode: 'insensitive' } } },
            ],
        }
        : {};
    const [users, total] = await Promise.all([
        prisma_1.prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                profile: { select: { firstName: true, lastName: true, isVerified: true, isActive: true, photos: true } },
                subscription: { select: { plan: true, fedapayStatus: true, expiresAt: true } },
                _count: { select: { matches1: true, matches2: true, sentLikes: true } },
            },
        }),
        prisma_1.prisma.user.count({ where }),
    ]);
    return {
        users: users.map((u) => ({
            id: u.id,
            email: u.email,
            phone: u.phone,
            provider: u.provider,
            isAdmin: u.isAdmin,
            createdAt: u.createdAt,
            profile: u.profile,
            subscription: u.subscription,
            matchCount: (u._count.matches1 ?? 0) + (u._count.matches2 ?? 0),
            likeCount: u._count.sentLikes ?? 0,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
}
async function banUser(userId, banned) {
    return prisma_1.prisma.profile.update({
        where: { userId },
        data: { isActive: !banned },
    });
}
async function promoteUser(userId, isAdmin) {
    return prisma_1.prisma.user.update({
        where: { id: userId },
        data: { isAdmin },
    });
}
// ── Vérifications d'identité ──────────────────────────────────────────────────
async function getPendingVerifications(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [verifs, total] = await Promise.all([
        prisma_1.prisma.verification.findMany({
            where: { status: 'PENDING', idFrontUrl: { not: null }, selfieUrl: { not: null } },
            skip,
            take: limit,
            orderBy: { createdAt: 'asc' },
            include: {
                user: {
                    include: {
                        profile: { select: { firstName: true, lastName: true, birthdate: true, photos: true } },
                    },
                },
            },
        }),
        prisma_1.prisma.verification.count({
            where: { status: 'PENDING', idFrontUrl: { not: null } },
        }),
    ]);
    return {
        verifications: verifs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
}
async function reviewVerification(userId, approved) {
    const status = approved ? 'APPROVED' : 'REJECTED';
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.verification.update({
            where: { userId },
            data: { status, reviewedAt: new Date() },
        }),
        prisma_1.prisma.profile.update({
            where: { userId },
            data: { isVerified: approved },
        }),
    ]);
    return { userId, status, isVerified: approved };
}
// ── Abonnements ────────────────────────────────────────────────────────────────
async function getSubscriptions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [subs, total] = await Promise.all([
        prisma_1.prisma.subscription.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    include: {
                        profile: { select: { firstName: true, lastName: true } },
                    },
                },
            },
        }),
        prisma_1.prisma.subscription.count(),
    ]);
    return {
        subscriptions: subs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
}
// ── Graphique inscriptions (7 derniers jours) ─────────────────────────────────
async function getRegistrationChart() {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
        const start = new Date();
        start.setDate(start.getDate() - i);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        const count = await prisma_1.prisma.user.count({
            where: { createdAt: { gte: start, lte: end } },
        });
        data.push({
            date: start.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
            users: count,
        });
    }
    return data;
}
//# sourceMappingURL=admin.service.js.map