"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentSubscription = getCurrentSubscription;
exports.activateBoost = activateBoost;
exports.createCheckout = createCheckout;
exports.payMobileMoney = payMobileMoney;
exports.checkMobilePayStatus = checkMobilePayStatus;
exports.verifyTransaction = verifyTransaction;
exports.handleWebhook = handleWebhook;
const axios_1 = __importStar(require("axios"));
const crypto_1 = require("crypto");
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
// ── Config plans ──────────────────────────────────────────────────────────────
const PLANS = {
    DECOUVERTE: { label: 'Découverte', amount: env_1.env.PLAN_PRICE_DECOUVERTE, durationDays: 30 },
    STANDARD: { label: 'Standard', amount: env_1.env.PLAN_PRICE_STANDARD, durationDays: 30 },
    PREMIUM: { label: 'Premium', amount: env_1.env.PLAN_PRICE_PREMIUM, durationDays: 30 },
};
// ── CinetPay ──────────────────────────────────────────────────────────────────
const CINETPAY_API = 'https://api-checkout.cinetpay.com/v2';
// ID de transaction unique ≤ 20 caractères alphanum (exigence CinetPay)
function generateTxId() {
    return ('AF' + (0, crypto_1.randomUUID)().replace(/-/g, '')).slice(0, 20);
}
function cinetpayBase(txId, plan) {
    const planInfo = PLANS[plan];
    return {
        apikey: env_1.env.CINETPAY_API_KEY,
        site_id: env_1.env.CINETPAY_SITE_ID,
        transaction_id: txId,
        amount: planInfo.amount,
        currency: 'XOF',
        description: `Abonnement Affinity ${planInfo.label}`,
        return_url: `${env_1.env.API_URL}/api/subscription/result?status=success&plan=${plan}`,
        notify_url: `${env_1.env.API_URL}/api/subscription/webhook`,
        customer_address: 'Lomé',
        customer_city: 'Lomé',
        customer_country: 'TG',
        customer_state: 'TG',
        customer_zip_code: '00228',
        channels: 'MOBILE_MONEY',
    };
}
// ── Public API ────────────────────────────────────────────────────────────────
async function getCurrentSubscription(userId) {
    return prisma_1.prisma.subscription.findUnique({ where: { userId } });
}
const BOOST_DURATION_MS = 3 * 60 * 60 * 1000; // 3 heures
async function activateBoost(userId) {
    const expiresAt = new Date(Date.now() + BOOST_DURATION_MS);
    await prisma_1.prisma.boost.create({ data: { userId, expiresAt } });
    return { activeUntil: expiresAt };
}
// Checkout web — retourne une URL CinetPay (fallback ou usage admin)
async function createCheckout(userId, plan, customer) {
    const planInfo = PLANS[plan];
    if (!planInfo)
        throw new Error('Plan invalide');
    const txId = generateTxId();
    let res;
    try {
        res = await axios_1.default.post(`${CINETPAY_API}/payment`, {
            ...cinetpayBase(txId, plan),
            customer_email: customer.email,
            customer_name: customer.firstname,
            customer_surname: customer.lastname,
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
    }
    catch (e) {
        if (e instanceof axios_1.AxiosError) {
            throw new Error(e.response?.data?.message ?? `Erreur réseau CinetPay: ${e.message}`);
        }
        throw e;
    }
    const data = res.data?.data;
    if (!data?.payment_token) {
        console.error('[CinetPay] Erreur checkout:', res.data);
        throw new Error(res.data?.message ?? 'CinetPay: aucun token reçu');
    }
    console.log('[CinetPay] Transaction créée:', txId, '| URL:', data.payment_url);
    const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
    await prisma_1.prisma.subscription.upsert({
        where: { userId },
        update: { plan, fedapayTxId: txId, fedapayStatus: 'pending', expiresAt },
        create: { userId, plan, fedapayTxId: txId, fedapayStatus: 'pending', expiresAt },
    });
    return { transactionId: txId, paymentUrl: data.payment_url, plan, amount: planInfo.amount };
}
// Paiement Mobile Money direct (T-Money / Flooz) — prompt USSD sur le téléphone
async function payMobileMoney(input) {
    const { userId, plan, phone, customer } = input;
    const planInfo = PLANS[plan];
    if (!planInfo)
        throw new Error('Plan invalide');
    // Normaliser le numéro (enlever +228 si présent)
    const normalizedPhone = phone.replace(/^\+228/, '').replace(/\D/g, '');
    const txId = generateTxId();
    console.log('[CinetPay Mobile] Initiation — txId:', txId, '| phone:', normalizedPhone, '| plan:', plan);
    let paymentUrl;
    try {
        const res = await axios_1.default.post(`${CINETPAY_API}/payment`, {
            ...cinetpayBase(txId, plan),
            customer_email: customer.email,
            customer_name: customer.firstname,
            customer_surname: customer.lastname,
            customer_phone_number: `+228${normalizedPhone}`,
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
            validateStatus: () => true,
        });
        console.log('[CinetPay Mobile] Réponse HTTP', res.status, ':', JSON.stringify(res.data).slice(0, 300));
        if (res.status >= 400) {
            throw new Error(res.data?.message ?? `Erreur CinetPay (${res.status})`);
        }
        paymentUrl = res.data?.data?.payment_url;
    }
    catch (e) {
        if (e instanceof axios_1.AxiosError) {
            throw new Error(e.response?.data?.message ?? e.message);
        }
        throw e;
    }
    // Sauvegarder en DB
    const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
    await prisma_1.prisma.subscription.upsert({
        where: { userId },
        update: { plan, fedapayTxId: txId, fedapayStatus: 'pending', expiresAt },
        create: { userId, plan, fedapayTxId: txId, fedapayStatus: 'pending', expiresAt },
    });
    return {
        transactionId: txId,
        status: 'pending',
        message: 'Confirmez le paiement sur votre téléphone',
        plan,
        amount: planInfo.amount,
        // checkoutUrl uniquement en mode non-production (bouton "Simuler" Flutter)
        ...(!env_1.env.IS_PROD && paymentUrl ? { checkoutUrl: paymentUrl } : {}),
    };
}
// Polling statut depuis Flutter
async function checkMobilePayStatus(userId) {
    const sub = await prisma_1.prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.fedapayTxId)
        return { status: 'not_found', approved: false };
    try {
        const { status, approved } = await verifyTransaction(sub.fedapayTxId);
        if (approved && sub.fedapayStatus !== 'approved') {
            await prisma_1.prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    fedapayStatus: 'approved',
                    expiresAt: new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
                },
            });
        }
        return { status, approved, plan: sub.plan };
    }
    catch {
        return { status: sub.fedapayStatus ?? 'pending', approved: false, plan: sub.plan };
    }
}
// Vérifier une transaction CinetPay
async function verifyTransaction(txId) {
    const res = await axios_1.default.post(`${CINETPAY_API}/payment/check`, {
        apikey: env_1.env.CINETPAY_API_KEY,
        site_id: env_1.env.CINETPAY_SITE_ID,
        transaction_id: txId,
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
    const code = String(res.data?.code ?? '');
    const status = String(res.data?.data?.status ?? 'PENDING').toUpperCase();
    const approved = code === '00' || status === 'ACCEPTED';
    return { status, approved };
}
// Webhook CinetPay (notify_url)
async function handleWebhook(payload) {
    // CinetPay envoie : cpm_trans_id, cpm_trans_status (ACCEPTED/REFUSED/CANCELLED)
    const txId = String(payload.cpm_trans_id ?? payload.transaction_id ?? '');
    const rawStatus = String(payload.cpm_trans_status ?? payload.status ?? '').toUpperCase();
    if (!txId)
        return;
    const approved = rawStatus === 'ACCEPTED';
    const sub = await prisma_1.prisma.subscription.findFirst({ where: { fedapayTxId: txId } });
    if (!sub)
        return;
    await prisma_1.prisma.subscription.update({
        where: { id: sub.id },
        data: {
            fedapayStatus: rawStatus.toLowerCase(),
            ...(approved && {
                expiresAt: new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
            }),
        },
    });
    console.log(`[CinetPay Webhook] tx=${txId} status=${rawStatus} plan=${sub.plan}`);
}
//# sourceMappingURL=subscription.service.js.map