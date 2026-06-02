"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOtpSchema = exports.sendOtpSchema = exports.deleteAccountSchema = exports.syncSchema = void 0;
const zod_1 = require("zod");
exports.syncSchema = zod_1.z.object({
    firebaseToken: zod_1.z.string().min(1, 'Token Firebase requis'),
    fcmToken: zod_1.z.string().nullish(), // accepte string, null ou undefined
});
exports.deleteAccountSchema = zod_1.z.object({
    firebaseToken: zod_1.z.string().min(1, 'Token Firebase requis'),
});
exports.sendOtpSchema = zod_1.z.object({
    phone: zod_1.z.string()
        .min(8, 'Numéro invalide')
        .max(15, 'Numéro invalide')
        .regex(/^[0-9+]+$/, 'Numéro invalide'),
});
exports.verifyOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(8),
    code: zod_1.z.string().length(4, 'Le code doit contenir 4 chiffres').regex(/^\d{4}$/),
});
//# sourceMappingURL=auth.schemas.js.map