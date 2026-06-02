"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeProfile = completeProfile;
exports.getMe = getMe;
exports.getProfile = getProfile;
exports.update = update;
exports.uploadPhoto = uploadPhoto;
exports.deletePhoto = deletePhoto;
exports.patchLocation = patchLocation;
const profile_service_1 = require("./profile.service");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const cloudinary_1 = require("../../config/cloudinary");
const response_1 = require("../../utils/response");
async function completeProfile(req, res) {
    try {
        const existing = await (0, profile_service_1.getMyProfile)(req.user.id);
        if (existing) {
            // Profil déjà existant → mise à jour plutôt qu'erreur
            const profile = await (0, profile_service_1.updateProfile)(req.user.id, req.body);
            (0, response_1.ok)(res, profile, 'Profil mis à jour');
            return;
        }
        const profile = await (0, profile_service_1.createProfile)(req.user.id, req.body);
        (0, response_1.created)(res, profile, 'Profil créé avec succès');
    }
    catch (err) {
        (0, response_1.serverError)(res, err instanceof Error ? err.message : undefined);
    }
}
async function getMe(req, res) {
    try {
        const profile = await (0, profile_service_1.getMyProfile)(req.user.id);
        if (!profile) {
            (0, response_1.notFound)(res, 'Profil non trouvé');
            return;
        }
        (0, response_1.ok)(res, profile);
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function getProfile(req, res) {
    try {
        const profile = await (0, profile_service_1.getProfileById)(req.params.userId);
        if (!profile) {
            (0, response_1.notFound)(res, 'Profil introuvable');
            return;
        }
        (0, response_1.ok)(res, profile);
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function update(req, res) {
    try {
        const profile = await (0, profile_service_1.updateProfile)(req.user.id, req.body);
        (0, response_1.ok)(res, profile, 'Profil mis à jour');
    }
    catch (err) {
        (0, response_1.serverError)(res, err instanceof Error ? err.message : undefined);
    }
}
async function uploadPhoto(req, res) {
    try {
        if (!req.file) {
            (0, response_1.badRequest)(res, 'Aucune photo fournie');
            return;
        }
        console.log('[upload] fichier reçu:', req.file.originalname, req.file.mimetype, req.file.size, 'bytes', 'buffer:', req.file.buffer?.length ?? 0, 'bytes');
        const photoUrl = await (0, upload_middleware_1.uploadFileToCloud)(req.file, 'affinity/photos');
        console.log('[upload] Cloudinary URL:', photoUrl);
        const profile = await (0, profile_service_1.addPhoto)(req.user.id, photoUrl);
        (0, response_1.ok)(res, { photos: profile.photos }, 'Photo ajoutée');
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur upload';
        console.error('[upload] ERREUR:', msg);
        (0, response_1.serverError)(res, msg);
    }
}
async function deletePhoto(req, res) {
    try {
        const index = parseInt(req.params.index, 10);
        if (isNaN(index)) {
            (0, response_1.badRequest)(res, 'Index invalide');
            return;
        }
        // Récupérer l'URL avant suppression pour la retirer de Cloudinary
        const currentProfile = await (0, profile_service_1.getMyProfile)(req.user.id);
        const urlToDelete = currentProfile?.photos[index];
        const profile = await (0, profile_service_1.removePhoto)(req.user.id, index);
        if (urlToDelete) {
            await (0, cloudinary_1.deleteFromCloudinary)(urlToDelete).catch(() => { });
        }
        (0, response_1.ok)(res, { photos: profile.photos }, 'Photo supprimée');
    }
    catch (err) {
        (0, response_1.serverError)(res, err instanceof Error ? err.message : undefined);
    }
}
async function patchLocation(req, res) {
    try {
        const { latitude, longitude, city } = req.body;
        await (0, profile_service_1.updateLocation)(req.user.id, latitude, longitude, city);
        (0, response_1.ok)(res, null, 'Localisation mise à jour');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
//# sourceMappingURL=profile.controller.js.map