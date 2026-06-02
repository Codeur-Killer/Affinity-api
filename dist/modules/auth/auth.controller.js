"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sync = sync;
exports.getMe = getMe;
exports.deleteAccount = deleteAccount;
exports.sendOtpHandler = sendOtpHandler;
exports.verifyOtpHandler = verifyOtpHandler;
const auth_service_1 = require("./auth.service");
const otp_service_1 = require("./otp.service");
const response_1 = require("../../utils/response");
// ── Firebase sync (email / Google) ──────────────────────────────────────────
async function sync(req, res) {
    try {
        const { firebaseToken, fcmToken } = req.body;
        const result = await (0, auth_service_1.syncFirebaseUser)(firebaseToken, fcmToken);
        (0, response_1.created)(res, {
            token: result.token,
            isNewUser: result.isNewUser,
            profileComplete: result.profileComplete,
            user: {
                id: result.user.id,
                email: result.user.email,
                phone: result.user.phone,
                provider: result.user.provider,
            },
        }, result.isNewUser ? 'Compte créé avec succès' : 'Connexion réussie');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur interne';
        if (message.includes('Firebase ID token') || message.includes('auth/')) {
            (0, response_1.badRequest)(res, 'Token Firebase invalide ou expiré');
        }
        else {
            console.error('[auth/sync]', message);
            (0, response_1.serverError)(res, message);
        }
    }
}
// ── Me (route protégée) ──────────────────────────────────────────────────────
async function getMe(req, res) {
    try {
        (0, response_1.ok)(res, { user: req.user });
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
// ── Suppression de compte ────────────────────────────────────────────────────
async function deleteAccount(req, res) {
    try {
        await (0, auth_service_1.deleteUserAccount)(req.user.id);
        (0, response_1.ok)(res, null, 'Compte supprimé avec succès');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
// ── OTP : envoi ───────────────────────────────────────────────────────────────
async function sendOtpHandler(req, res) {
    try {
        const { phone } = req.body;
        await (0, otp_service_1.sendOtp)(phone);
        (0, response_1.ok)(res, null, 'Code envoyé par SMS');
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur envoi SMS';
        console.error('[auth/otp/send]', msg);
        (0, response_1.badRequest)(res, msg);
    }
}
// ── OTP : vérification ────────────────────────────────────────────────────────
async function verifyOtpHandler(req, res) {
    try {
        const { phone, code } = req.body;
        const result = await (0, otp_service_1.verifyOtp)(phone, code);
        (0, response_1.ok)(res, {
            token: result.token,
            userId: result.userId,
            isNewUser: result.isNewUser,
            profileComplete: result.profileComplete,
        }, result.isNewUser ? 'Compte créé avec succès' : 'Connexion réussie');
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Code invalide';
        (0, response_1.badRequest)(res, msg);
    }
}
//# sourceMappingURL=auth.controller.js.map