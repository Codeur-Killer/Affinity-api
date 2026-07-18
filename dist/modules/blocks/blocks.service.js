"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockedUsers = getBlockedUsers;
exports.blockUser = blockUser;
exports.unblockUser = unblockUser;
const prisma_1 = require("../../config/prisma");
async function getBlockedUsers(blockerId) {
    const blocks = await prisma_1.prisma.block.findMany({
        where: { blockerId },
        include: {
            blocked: {
                include: { profile: { select: { firstName: true, photos: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    return blocks.map((b) => ({
        userId: b.blockedId,
        firstName: b.blocked.profile?.firstName ?? 'Utilisateur',
        photo: b.blocked.profile?.photos?.[0] ?? null,
        blockedAt: b.createdAt,
    }));
}
async function blockUser(blockerId, blockedId) {
    if (blockerId === blockedId)
        throw new Error('Impossible de se bloquer soi-même.');
    await prisma_1.prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        update: {},
        create: { blockerId, blockedId },
    });
}
async function unblockUser(blockerId, blockedId) {
    await prisma_1.prisma.block.deleteMany({ where: { blockerId, blockedId } });
}
//# sourceMappingURL=blocks.service.js.map