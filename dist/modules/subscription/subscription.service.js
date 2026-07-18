"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentSubscription = getCurrentSubscription;
exports.activateBoost = activateBoost;
exports.payMobileMoney = payMobileMoney;
exports.checkMobilePayStatus = checkMobilePayStatus;
exports.createCheckout = createCheckout;
exports.verifyTransaction = verifyTransaction;
exports.handleWebhook = handleWebhook;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
// ── Config plans ──────────────────────────────────────────────────────────────
const PLANS = {
    DECOUVERTE: { label: 'Découverte', amount: env_1.env.PLAN_PRICE_DECOUVERTE, durationDays: 30 },
    STANDARD: { label: 'Standard', amount: env_1.env.PLAN_PRICE_STANDARD, durationDays: 30 },
    PREMIUM: { label: 'Premium', amount: env_1.env.PLAN_PRICE_PREMIUM, durationDays: 30 },
};
// ── Client HTTP FedaPay ───────────────────────────────────────────────────────
const fedapay = axios_1.default.create({
    baseURL: env_1.env.IS_PROD
        ? 'https://api.fedapay.com/v1'
        : 'https://sandbox-api.fedapay.com/v1',
    headers: {
        Authorization: `Bearer ${env_1.env.FEDAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});
// ── Helpers ───────────────────────────────────────────────────────────────────
function toTogoPhone(raw) {
    const digits = raw.replace(/\D/g, '');
    const local = digits.startsWith('228') ? digits.slice(3) : digits;
    return `+228${local}`;
}
async function createTransaction(planInfo, customer, phone) {
    const body = {
        description: `Affinity ${planInfo.label} — 30 jours`,
        amount: planInfo.amount,
        currency: { iso: 'XOF' },
        callback_url: `${env_1.env.API_URL}/api/subscription/webhook`,
        customer: {
            firstname: customer.firstname,
            lastname: customer.lastname,
            email: customer.email,
            ...(phone ? { phone_number: { number: phone, country: 'TG' } } : {}),
        },
    };
    const resp = await fedapay.post('/transactions', body);
    return resp.data['v1/transaction'];
}
async function fetchTransaction(id) {
    const resp = await fedapay.get(`/transactions/${id}`);
    return resp.data['v1/transaction'];
}
// ── Public API ────────────────────────────────────────────────────────────────
async function getCurrentSubscription(userId) {
    return prisma_1.prisma.subscription.findUnique({ where: { userId } });
}
const BOOST_DURATION_MS = 3 * 60 * 60 * 1000;
async function activateBoost(userId) {
    const expiresAt = new Date(Date.now() + BOOST_DURATION_MS);
    await prisma_1.prisma.boost.create({ data: { userId, expiresAt } });
    return { activeUntil: expiresAt };
}
// Paiement Mobile Money direct — envoie une demande USSD push (T-Money / Flooz)
async function payMobileMoney(input) {
    const { userId, plan, phone, customer } = input;
    const planInfo = PLANS[plan];
    if (!planInfo)
        throw new Error('Plan invalide');
    const formattedPhone = toTogoPhone(phone);
    const tx = await createTransaction(planInfo, customer, formattedPhone);
    // Déclencher le débit USSD sur le téléphone du client
    await fedapay.post(`/transactions/${tx.id}/pay`, {
        phone_number: { number: formattedPhone, country: 'TG' },
    });
    const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
    await prisma_1.prisma.subscription.upsert({
        where: { userId },
        update: { plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt },
        create: { userId, plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt },
    });
    return {
        transactionId: String(tx.id),
        status: 'pending',
        message: 'Confirmez le paiement sur votre téléphone (notification USSD)',
        plan,
        amount: planInfo.amount,
    };
}
// Polling statut depuis Flutter
async function checkMobilePayStatus(userId) {
    const sub = await prisma_1.prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.fedapayTxId)
        return { status: 'not_found', approved: false };
    if (sub.fedapayStatus === 'approved') {
        return { status: 'approved', approved: true, plan: sub.plan };
    }
    try {
        const tx = await fetchTransaction(sub.fedapayTxId);
        const approved = tx.status === 'approved';
        if (approved) {
            await prisma_1.prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    fedapayStatus: 'approved',
                    expiresAt: new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
                },
            });
        }
        return { status: tx.status, approved, plan: sub.plan };
    }
    catch {
        return { status: sub.fedapayStatus ?? 'pending', approved: false, plan: sub.plan };
    }
}
// Checkout web — retourne l'URL de paiement hébergée FedaPay
async function createCheckout(userId, plan, customer) {
    const planInfo = PLANS[plan];
    if (!planInfo)
        throw new Error('Plan invalide');
    const tx = await createTransaction(planInfo, customer);
    // Générer le token de la page de paiement hébergée
    const tokenResp = await fedapay.get(`/transactions/${tx.id}/token`);
    const paymentUrl = tokenResp.data.url;
    const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
    await prisma_1.prisma.subscription.upsert({
        where: { userId },
        update: { plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt },
        create: { userId, plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt },
    });
    return { transactionId: String(tx.id), paymentUrl, plan, amount: planInfo.amount };
}
// Vérification directe d'une transaction par son ID
async function verifyTransaction(txId) {
    const tx = await fetchTransaction(txId);
    return { status: tx.status, approved: tx.status === 'approved' };
}
// Webhook FedaPay (callback_url) — activé à chaque changement de statut
async function handleWebhook(payload) {
    const event = payload;
    if (event.name !== 'transaction.updated')
        return;
    const txId = event.object?.id;
    const status = event.object?.status ?? '';
    if (!txId)
        return;
    const sub = await prisma_1.prisma.subscription.findFirst({ where: { fedapayTxId: String(txId) } });
    if (!sub)
        return;
    await prisma_1.prisma.subscription.update({
        where: { id: sub.id },
        data: {
            fedapayStatus: status,
            ...(status === 'approved' && {
                expiresAt: new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
            }),
        },
    });
}
//# sourceMappingURL=subscription.service.js.map