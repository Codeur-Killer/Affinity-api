"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = get;
exports.update = update;
exports.patchFcmToken = patchFcmToken;
const settings_service_1 = require("./settings.service");
const response_1 = require("../../utils/response");
async function get(req, res) {
    try {
        const settings = await (0, settings_service_1.getSettings)(req.user.id);
        (0, response_1.ok)(res, settings);
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function update(req, res) {
    try {
        const settings = await (0, settings_service_1.updateSettings)(req.user.id, req.body);
        (0, response_1.ok)(res, settings, 'Paramètres mis à jour');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function patchFcmToken(req, res) {
    try {
        const { fcmToken } = req.body;
        if (!fcmToken) {
            (0, response_1.badRequest)(res, 'fcmToken requis');
            return;
        }
        await (0, settings_service_1.updateFcmToken)(req.user.id, fcmToken);
        (0, response_1.ok)(res, null, 'Token FCM enregistré');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
//# sourceMappingURL=settings.controller.js.map