"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncFirebaseUser = syncFirebaseUser;
exports.deleteUserAccount = deleteUserAccount;
const prisma_1 = require("../../config/prisma");
const firebase_1 = require("../../config/firebase");
const jwt_1 = require("../../utils/jwt");
async function syncFirebaseUser(firebaseToken, fcmToken) {
    const decoded = await (0, firebase_1.getFirebaseAuth)().verifyIdToken(firebaseToken);
    const { uid, email, phone_number: phone } = decoded;
    let isNewUser = false;
    let user = await prisma_1.prisma.user.findUnique({
        where: { firebaseUid: uid },
        include: { profile: true, settings: true },
    });
    if (!user) {
        isNewUser = true;
        user = await prisma_1.prisma.user.create({
            data: {
                firebaseUid: uid,
                email: email ?? null,
                phone: phone ?? null,
                provider: decoded.firebase.sign_in_provider ?? 'email',
                settings: {
                    create: {},
                },
            },
            include: { profile: true, settings: true },
        });
    }
    if (fcmToken && user.settings) {
        await prisma_1.prisma.userSettings.update({
            where: { userId: user.id },
            data: { fcmToken },
        });
    }
    else if (fcmToken) {
        await prisma_1.prisma.userSettings.upsert({
            where: { userId: user.id },
            update: { fcmToken },
            create: { userId: user.id, fcmToken },
        });
    }
    const token = (0, jwt_1.signToken)({
        userId: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
    });
    const profileComplete = !!user.profile;
    return { token, user, isNewUser, profileComplete };
}
async function deleteUserAccount(userId) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return;
    await (0, firebase_1.getFirebaseAuth)().deleteUser(user.firebaseUid).catch(() => { });
    await prisma_1.prisma.user.delete({ where: { id: userId } });
}
//# sourceMappingURL=auth.service.js.map