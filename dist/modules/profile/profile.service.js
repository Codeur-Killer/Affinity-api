"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProfile = createProfile;
exports.getMyProfile = getMyProfile;
exports.getProfileById = getProfileById;
exports.updateProfile = updateProfile;
exports.addPhoto = addPhoto;
exports.removePhoto = removePhoto;
exports.updateLocation = updateLocation;
const prisma_1 = require("../../config/prisma");
const plan_limits_1 = require("../subscription/plan-limits");
const MAX_PHOTOS = 5;
async function createProfile(userId, data) {
    return prisma_1.prisma.profile.create({
        data: {
            userId,
            firstName: data.firstName,
            lastName: data.lastName,
            neighborhood: data.neighborhood,
            bio: data.bio,
            birthdate: new Date(data.birthdate),
            gender: data.gender,
            interests: data.interests,
            relationshipGoal: data.relationshipGoal,
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city,
        },
    });
}
async function getMyProfile(userId) {
    return prisma_1.prisma.profile.findUnique({ where: { userId } });
}
async function getProfileById(userId) {
    return prisma_1.prisma.profile.findUnique({ where: { userId } });
}
async function updateProfile(userId, data) {
    let incognito;
    if (data.incognito !== undefined) {
        const access = await (0, plan_limits_1.getAccessStatus)(userId);
        // Le plan Découverte ne débloque pas le mode Incognito : on ignore la valeur envoyée.
        incognito = access.limits.canUseIncognito ? data.incognito : false;
    }
    return prisma_1.prisma.profile.update({
        where: { userId },
        data: {
            ...(data.firstName && { firstName: data.firstName }),
            ...(data.lastName !== undefined && { lastName: data.lastName }),
            ...(data.neighborhood !== undefined && { neighborhood: data.neighborhood }),
            ...(data.bio !== undefined && { bio: data.bio }),
            ...(data.birthdate && { birthdate: new Date(data.birthdate) }),
            ...(data.gender && { gender: data.gender }),
            ...(data.interests && { interests: data.interests }),
            ...(data.relationshipGoal && { relationshipGoal: data.relationshipGoal }),
            ...(data.latitude !== undefined && { latitude: data.latitude }),
            ...(data.longitude !== undefined && { longitude: data.longitude }),
            ...(data.city !== undefined && { city: data.city }),
            ...(incognito !== undefined && { incognito }),
            lastSeenAt: new Date(),
        },
    });
}
async function addPhoto(userId, photoUrl) {
    const profile = await prisma_1.prisma.profile.findUnique({ where: { userId } });
    if (!profile)
        throw new Error('Profil introuvable');
    if (profile.photos.length >= MAX_PHOTOS) {
        throw new Error(`Maximum ${MAX_PHOTOS} photos autorisées`);
    }
    return prisma_1.prisma.profile.update({
        where: { userId },
        data: { photos: [...profile.photos, photoUrl] },
    });
}
async function removePhoto(userId, index) {
    const profile = await prisma_1.prisma.profile.findUnique({ where: { userId } });
    if (!profile)
        throw new Error('Profil introuvable');
    if (index < 0 || index >= profile.photos.length) {
        throw new Error('Index de photo invalide');
    }
    const updated = profile.photos.filter((_, i) => i !== index);
    return prisma_1.prisma.profile.update({
        where: { userId },
        data: { photos: updated },
    });
}
async function updateLocation(userId, latitude, longitude, city) {
    await prisma_1.prisma.profile.update({
        where: { userId },
        data: { latitude, longitude, city, lastSeenAt: new Date() },
    });
}
//# sourceMappingURL=profile.service.js.map