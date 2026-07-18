"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = getStats;
exports.applyCode = applyCode;
const response_1 = require("../../utils/response");
const referral_service_1 = require("./referral.service");
async function getStats(req, res) {
    const stats = await (0, referral_service_1.getReferralStats)(req.user.id);
    (0, response_1.ok)(res, stats);
}
async function applyCode(req, res) {
    const { code } = req.body;
    if (!code?.trim()) {
        (0, response_1.badRequest)(res, 'Code requis');
        return;
    }
    const result = await (0, referral_service_1.useReferralCode)(req.user.id, code.trim().toUpperCase());
    if (!result.success) {
        (0, response_1.badRequest)(res, result.message);
        return;
    }
    (0, response_1.ok)(res, { message: result.message });
}
//# sourceMappingURL=referral.controller.js.map