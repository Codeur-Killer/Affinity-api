"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVerificationStatus = getVerificationStatus;
exports.submitIdCard = submitIdCard;
exports.submitSelfie = submitSelfie;
const prisma_1 = require("../../config/prisma");
async function getVerificationStatus(userId) {
    return prisma_1.prisma.verification.findUnique({ where: { userId } });
}
async function submitIdCard(userId, idFrontUrl, idBackUrl) {
    return prisma_1.prisma.verification.upsert({
        where: { userId },
        update: { idFrontUrl, idBackUrl, status: 'PENDING' },
        create: { userId, idFrontUrl, idBackUrl },
    });
}
async function submitSelfie(userId, selfieUrl) {
    return prisma_1.prisma.verification.upsert({
        where: { userId },
        update: { selfieUrl, status: 'PENDING' },
        create: { userId, selfieUrl },
    });
}
//# sourceMappingURL=verification.service.js.map