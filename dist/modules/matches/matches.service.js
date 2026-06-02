"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyMatches = getMyMatches;
exports.getMatchById = getMatchById;
exports.unmatch = unmatch;
const prisma_1 = require("../../config/prisma");
async function getMyMatches(userId) {
    const matches = await prisma_1.prisma.match.findMany({
        where: {
            OR: [{ user1Id: userId }, { user2Id: userId }],
        },
        orderBy: { createdAt: 'desc' },
        include: {
            user1: { include: { profile: true } },
            user2: { include: { profile: true } },
        },
    });
    return matches.map((m) => {
        const other = m.user1Id === userId ? m.user2 : m.user1;
        return {
            matchId: m.id,
            conversationId: m.conversationId,
            createdAt: m.createdAt,
            user: {
                id: other.id,
                profile: other.profile,
            },
        };
    });
}
async function getMatchById(matchId, userId) {
    const match = await prisma_1.prisma.match.findUnique({
        where: { id: matchId },
        include: {
            user1: { include: { profile: true } },
            user2: { include: { profile: true } },
        },
    });
    if (!match)
        return null;
    if (match.user1Id !== userId && match.user2Id !== userId)
        return null;
    const other = match.user1Id === userId ? match.user2 : match.user1;
    return {
        matchId: match.id,
        conversationId: match.conversationId,
        createdAt: match.createdAt,
        user: { id: other.id, profile: other.profile },
    };
}
async function unmatch(matchId, userId) {
    const match = await prisma_1.prisma.match.findUnique({ where: { id: matchId } });
    if (!match)
        return false;
    if (match.user1Id !== userId && match.user2Id !== userId)
        return false;
    await prisma_1.prisma.match.delete({ where: { id: matchId } });
    return true;
}
//# sourceMappingURL=matches.service.js.map