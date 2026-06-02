"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = getNotifications;
exports.markOneRead = markOneRead;
exports.markAllRead = markAllRead;
const prisma_1 = require("../../config/prisma");
const PAGE_SIZE = 20;
async function getNotifications(userId, page = 1) {
    const skip = (page - 1) * PAGE_SIZE;
    const [notifications, total] = await Promise.all([
        prisma_1.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: PAGE_SIZE,
        }),
        prisma_1.prisma.notification.count({ where: { userId } }),
    ]);
    const unreadCount = await prisma_1.prisma.notification.count({
        where: { userId, readAt: null },
    });
    return { notifications, total, page, unreadCount };
}
async function markOneRead(notifId, userId) {
    const notif = await prisma_1.prisma.notification.findFirst({
        where: { id: notifId, userId },
    });
    if (!notif)
        return false;
    await prisma_1.prisma.notification.update({
        where: { id: notifId },
        data: { readAt: new Date() },
    });
    return true;
}
async function markAllRead(userId) {
    await prisma_1.prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
    });
}
//# sourceMappingURL=notifications.service.js.map