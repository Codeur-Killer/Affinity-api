"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateVipCode = validateVipCode;
exports.getCurrentSubscription = getCurrentSubscription;
exports.activateBoost = activateBoost;
exports.payMobileMoney = payMobileMoney;
exports.checkMobilePayStatus = checkMobilePayStatus;
exports.createCheckout = createCheckout;
exports.verifyTransaction = verifyTransaction;
exports.handleWebhook = handleWebhook;
const fedapay_1 = require("fedapay");
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
// Détecter live vs sandbox depuis le préfixe de la clé (indépendant de NODE_ENV)
const fedaEnv = env_1.env.FEDAPAY_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'sandbox';
fedapay_1.FedaPay.setApiKey(env_1.env.FEDAPAY_SECRET_KEY);
fedapay_1.FedaPay.setEnvironment(fedaEnv);
// ── Config plans ──────────────────────────────────────────────────────────────
const PLANS = {
    DECOUVERTE: { label: 'Découverte', amount: env_1.env.PLAN_PRICE_DECOUVERTE, durationDays: 30 },
    STANDARD: { label: 'Standard', amount: env_1.env.PLAN_PRICE_STANDARD, durationDays: 30 },
    PREMIUM: { label: 'Premium', amount: env_1.env.PLAN_PRICE_PREMIUM, durationDays: 30 },
};
// ── Helpers VIP ───────────────────────────────────────────────────────────────
async function validateVipCode(code) {
    const vipUser = await prisma_1.prisma.user.findFirst({
        where: { vipCode: code.toUpperCase(), isVip: true },
        select: { id: true },
    });
    if (!vipUser) {
        return { valid: false, discountPct: 0, discountInfo: 'Code VIP invalide ou inactif' };
    }
    return { valid: true, discountPct: 10, discountInfo: '10% de réduction appliquée' };
}
async function resolveVipCode(code) {
    if (!code)
        return { discountAmount: 0 };
    const vipUser = await prisma_1.prisma.user.findFirst({
        where: { vipCode: code.toUpperCase(), isVip: true },
        select: { id: true },
    });
    return vipUser
        ? { vipUserId: vipUser.id, discountAmount: 10 }
        : { discountAmount: 0 };
}
async function createVipReferralIfNeeded(sub) {
    if (!sub.vipCodeUsed)
        return;
    // Guard: don't create duplicates
    const alreadyExists = await prisma_1.prisma.vipReferral.findFirst({
        where: { subscriberUserId: sub.userId },
    });
    if (alreadyExists)
        return;
    const vipUser = await prisma_1.prisma.user.findFirst({
        where: { vipCode: sub.vipCodeUsed, isVip: true },
        select: { id: true },
    });
    if (!vipUser)
        return;
    await prisma_1.prisma.vipReferral.create({
        data: {
            vipUserId: vipUser.id,
            subscriberUserId: sub.userId,
            commission: 950,
            plan: sub.plan,
        },
    });
}
// ── Helpers ───────────────────────────────────────────────────────────────────
function toTogoPhone(raw) {
    const digits = raw.replace(/\D/g, '');
    const local = digits.startsWith('228') ? digits.slice(3) : digits;
    return `+228${local}`;
}
async function createFedaTransaction(planInfo, customer, phone) {
    try {
        return await fedapay_1.Transaction.create({
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
        });
    }
    catch (err) {
        const e = err;
        console.error('[FedaPay] Erreur création transaction:', 'status=', e['httpStatus'], '| msg=', e['errorMessage'] ?? e['message'], '| errors=', JSON.stringify(e['errors'] ?? {}));
        throw err;
    }
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
// Paiement Mobile Money — crée la transaction et retourne l'URL de checkout FedaPay
async function payMobileMoney(input) {
    const { userId, plan, phone, customer, vipCode } = input;
    const planInfo = PLANS[plan];
    if (!planInfo)
        throw new Error('Plan invalide');
    const formattedPhone = toTogoPhone(phone);
    const { vipUserId, discountAmount: discountPct } = await resolveVipCode(vipCode);
    const finalAmount = discountPct > 0
        ? Math.round(planInfo.amount * (1 - discountPct / 100))
        : planInfo.amount;
    const discountAmt = planInfo.amount - finalAmount;
    const effectivePlanInfo = { ...planInfo, amount: finalAmount };
    const tx = await createFedaTransaction(effectivePlanInfo, customer, formattedPhone);
    const token = await tx.generateToken();
    const checkoutUrl = (token.url ?? token.token);
    const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
    await prisma_1.prisma.subscription.upsert({
        where: { userId },
        update: {
            plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt,
            ...(vipUserId && { vipCodeUsed: vipCode.toUpperCase(), discountAmount: discountAmt }),
        },
        create: {
            userId, plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt,
            ...(vipUserId && { vipCodeUsed: vipCode.toUpperCase(), discountAmount: discountAmt }),
        },
    });
    return {
        transactionId: String(tx.id),
        status: 'pending',
        message: 'Complétez votre paiement sur la page FedaPay',
        plan,
        amount: finalAmount,
        checkoutUrl,
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
        const tx = await fedapay_1.Transaction.retrieve(Number(sub.fedapayTxId));
        const txStatus = String(tx.status ?? '');
        const approved = txStatus === 'approved';
        if (approved) {
            await prisma_1.prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    fedapayStatus: 'approved',
                    expiresAt: new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
                },
            });
            await createVipReferralIfNeeded(sub);
        }
        return { status: txStatus, approved, plan: sub.plan };
    }
    catch {
        return { status: sub.fedapayStatus ?? 'pending', approved: false, plan: sub.plan };
    }
}
// Checkout web — retourne l'URL de paiement hébergée FedaPay
async function createCheckout(userId, plan, customer, vipCode) {
    const planInfo = PLANS[plan];
    if (!planInfo)
        throw new Error('Plan invalide');
    const { vipUserId, discountAmount: discountPct } = await resolveVipCode(vipCode);
    const finalAmount = discountPct > 0
        ? Math.round(planInfo.amount * (1 - discountPct / 100))
        : planInfo.amount;
    const discountAmt = planInfo.amount - finalAmount;
    const tx = await createFedaTransaction({ ...planInfo, amount: finalAmount }, customer);
    const token = await tx.generateToken();
    const paymentUrl = (token.url ?? token.token);
    const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
    await prisma_1.prisma.subscription.upsert({
        where: { userId },
        update: {
            plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt,
            ...(vipUserId && { vipCodeUsed: vipCode.toUpperCase(), discountAmount: discountAmt }),
        },
        create: {
            userId, plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt,
            ...(vipUserId && { vipCodeUsed: vipCode.toUpperCase(), discountAmount: discountAmt }),
        },
    });
    return { transactionId: String(tx.id), paymentUrl, plan, amount: finalAmount };
}
// Vérification directe d'une transaction
async function verifyTransaction(txId) {
    const tx = await fedapay_1.Transaction.retrieve(Number(txId));
    const status = String(tx.status ?? '');
    return { status, approved: status === 'approved' };
}
// Webhook FedaPay — appelé à chaque changement de statut
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
    const wasAlreadyApproved = sub.fedapayStatus === 'approved';
    await prisma_1.prisma.subscription.update({
        where: { id: sub.id },
        data: {
            fedapayStatus: status,
            ...(status === 'approved' && {
                expiresAt: new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
            }),
        },
    });
    if (status === 'approved' && !wasAlreadyApproved) {
        await createVipReferralIfNeeded(sub);
    }
}
//# sourceMappingURL=subscription.service.js.map