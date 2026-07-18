"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTogoPhone = formatTogoPhone;
exports.sendOtp = sendOtp;
exports.verifyOtp = verifyOtp;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const jwt_1 = require("../../utils/jwt");
const firebase_1 = require("../../config/firebase");
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
function generateOtpCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}
function formatTogoPhone(raw) {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('228') && digits.length >= 11)
        return `+${digits}`;
    if (digits.length === 8)
        return `+228${digits}`;
    return `+${digits}`;
}
// ── AfrikSMS — GET avec query params (comme le service Laravel officiel) ──────
async function sendSmsAfrik(phone, message) {
    // Construire l'URL exactement comme le PHP :
    // ?ClientId=...&ApiKey=...&SenderId=...&Message=...&MobileNumbers=...
    const params = new URLSearchParams({
        ClientId: env_1.env.SMS_CLIENT_ID,
        ApiKey: env_1.env.SMS_API_KEY,
        SenderId: env_1.env.SMS_SENDER_ID,
        Message: message,
        MobileNumbers: phone,
    });
    const url = `${env_1.env.SMS_API_URL}?${params.toString()}`;
    console.log('[AfrikSMS] GET →', url.replace(env_1.env.SMS_API_KEY, '***'));
    const res = await axios_1.default.get(url, {
        timeout: 30000,
        maxRedirects: 10,
        validateStatus: (s) => s < 500, // ne pas throw sur les 4xx, on les logge
    });
    const httpCode = res.status;
    const data = res.data;
    console.log('[AfrikSMS] HTTP', httpCode, ':', JSON.stringify(data));
    if (![200, 201].includes(httpCode)) {
        throw new Error(`AfrikSMS HTTP ${httpCode}: ${JSON.stringify(data)}`);
    }
}
// ── Envoie un OTP ──────────────────────────────────────────────────────────────
async function sendOtp(rawPhone) {
    const phone = formatTogoPhone(rawPhone);
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    // Invalide les anciens codes
    await prisma_1.prisma.otpCode.updateMany({
        where: { phone, verified: false },
        data: { expiresAt: new Date(0) },
    });
    await prisma_1.prisma.otpCode.create({ data: { phone, code, expiresAt } });
    // En développement uniquement pour faciliter les tests
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[OTP DEV] ${phone} → ${code}`);
    }
    if (env_1.env.SMS_API_KEY && env_1.env.SMS_CLIENT_ID) {
        await sendSmsAfrik(phone, `Votre code Affinity : ${code}\nValable 5 minutes. Ne partagez jamais ce code.`);
    }
    else {
        console.warn('[OTP] SMS non configuré — code non envoyé pour', phone);
    }
}
async function verifyOtp(rawPhone, code) {
    const phone = formatTogoPhone(rawPhone);
    const record = await prisma_1.prisma.otpCode.findFirst({
        where: { phone, verified: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
    });
    if (!record)
        throw new Error('Code expiré. Appuyez sur « Renvoyer ».');
    if (record.attempts >= MAX_ATTEMPTS) {
        await prisma_1.prisma.otpCode.update({ where: { id: record.id }, data: { expiresAt: new Date(0) } });
        throw new Error('Trop de tentatives. Demandez un nouveau code.');
    }
    if (record.code !== code) {
        await prisma_1.prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
        throw new Error(`Code incorrect. ${MAX_ATTEMPTS - record.attempts - 1} tentative(s) restante(s).`);
    }
    await prisma_1.prisma.otpCode.update({ where: { id: record.id }, data: { verified: true } });
    const fakeFirebaseUid = `phone_${phone}`;
    let isNewUser = false;
    let user = await prisma_1.prisma.user.findFirst({
        where: { OR: [{ phone }, { firebaseUid: fakeFirebaseUid }] },
        include: { profile: true, settings: true },
    });
    if (!user) {
        isNewUser = true;
        user = await prisma_1.prisma.user.create({
            data: { firebaseUid: fakeFirebaseUid, phone, provider: 'phone', settings: { create: {} } },
            include: { profile: true, settings: true },
        });
    }
    const token = (0, jwt_1.signToken)({ userId: user.id, firebaseUid: user.firebaseUid, email: user.email });
    const profileComplete = !!user.profile;
    // Créer un custom token Firebase avec le firebaseUid comme UID
    // Cela permet à l'utilisateur phone de s'authentifier auprès de Firestore
    let firebaseToken;
    try {
        firebaseToken = await (0, firebase_1.getFirebaseAuth)().createCustomToken(user.firebaseUid);
    }
    catch (e) {
        console.warn('[OTP] Impossible de créer le custom token Firebase:', e);
    }
    return { token, userId: user.id, isNewUser, profileComplete, firebaseToken };
}
//# sourceMappingURL=otp.service.js.map