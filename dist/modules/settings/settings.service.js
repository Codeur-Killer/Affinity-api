"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
exports.updateFcmToken = updateFcmToken;
const prisma_1 = require("../../config/prisma");
async function getSettings(userId) {
    return prisma_1.prisma.userSettings.upsert({
        where: { userId },
        update: {},
        create: { userId },
    });
}
async function updateSettings(userId, data) {
    return prisma_1.prisma.userSettings.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
    });
}
async function updateFcmToken(userId, fcmToken) {
    await prisma_1.prisma.userSettings.upsert({
        where: { userId },
        update: { fcmToken },
        create: { userId, fcmToken },
    });
}
//# sourceMappingURL=settings.service.js.map