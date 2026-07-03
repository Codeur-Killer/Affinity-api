"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscription = getSubscription;
exports.boost = boost;
exports.checkout = checkout;
exports.mobilePay = mobilePay;
exports.mobilePayStatus = mobilePayStatus;
exports.webhook = webhook;
exports.verifyTx = verifyTx;
exports.devConfirm = devConfirm;
exports.getPlans = getPlans;
const subscription_service_1 = require("./subscription.service");
const plan_limits_1 = require("./plan-limits");
const response_1 = require("../../utils/response");
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const VALID_PLANS = ['DECOUVERTE', 'STANDARD', 'PREMIUM'];
async function getSubscription(req, res) {
    try {
        const sub = await (0, subscription_service_1.getCurrentSubscription)(req.user.id);
        const access = await (0, plan_limits_1.getAccessStatus)(req.user.id);
        (0, response_1.ok)(res, {
            subscription: sub,
            isActive: access.isActive,
            plan: access.plan,
            isVerified: access.isVerified,
            canSwipe: access.canSwipe,
            limits: access.limits,
            usage: access.usage,
        });
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function boost(req, res) {
    try {
        const access = await (0, plan_limits_1.getAccessStatus)(req.user.id);
        if (!access.isActive) {
            (0, response_1.forbidden)(res, 'Un abonnement actif est requis pour utiliser un boost');
            return;
        }
        const { boostsPerMonth } = access.limits;
        if (boostsPerMonth !== null && access.usage.boostsThisMonth >= boostsPerMonth) {
            (0, response_1.forbidden)(res, 'Limite de boosts mensuels atteinte pour votre plan');
            return;
        }
        const result = await (0, subscription_service_1.activateBoost)(req.user.id);
        (0, response_1.ok)(res, result, 'Boost activé pour 3 heures');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function checkout(req, res) {
    try {
        const { plan } = req.body;
        if (!VALID_PLANS.includes(plan)) {
            (0, response_1.badRequest)(res, `Plan invalide. Valeurs : ${VALID_PLANS.join(', ')}`);
            return;
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id }, include: { profile: true },
        });
        if (!user) {
            (0, response_1.badRequest)(res, 'Utilisateur introuvable');
            return;
        }
        const customer = {
            email: user.email ?? `user_${user.id}@affinity.app`,
            firstname: user.profile?.firstName ?? 'Utilisateur',
            lastname: user.profile?.lastName ?? 'Affinity',
        };
        const result = await (0, subscription_service_1.createCheckout)(req.user.id, plan, customer);
        (0, response_1.ok)(res, result, 'Lien de paiement créé');
    }
    catch (err) {
        (0, response_1.serverError)(res, err instanceof Error ? err.message : 'Erreur paiement');
    }
}
// ── Paiement Mobile Money direct (T-Money / Flooz) ──────────────────────────
async function mobilePay(req, res) {
    try {
        const { plan, phone, network } = req.body;
        if (!VALID_PLANS.includes(plan)) {
            (0, response_1.badRequest)(res, `Plan invalide. Valeurs : ${VALID_PLANS.join(', ')}`);
            return;
        }
        if (!phone || phone.replace(/\D/g, '').length < 8) {
            (0, response_1.badRequest)(res, 'Numéro de téléphone invalide');
            return;
        }
        if (!network) {
            (0, response_1.badRequest)(res, 'Réseau requis (tm_money, flooz, mtn)');
            return;
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id }, include: { profile: true },
        });
        if (!user) {
            (0, response_1.badRequest)(res, 'Utilisateur introuvable');
            return;
        }
        const result = await (0, subscription_service_1.payMobileMoney)({
            userId: req.user.id,
            plan: plan,
            phone,
            network,
            customer: {
                email: user.email ?? `user_${user.id}@affinity.app`,
                firstname: user.profile?.firstName ?? 'Utilisateur',
                lastname: user.profile?.lastName ?? 'Affinity',
            },
        });
        (0, response_1.ok)(res, result, result.message);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur paiement mobile';
        (0, response_1.serverError)(res, msg);
    }
}
// ── Vérification statut (polling depuis Flutter) ─────────────────────────────
async function mobilePayStatus(req, res) {
    try {
        const result = await (0, subscription_service_1.checkMobilePayStatus)(req.user.id);
        (0, response_1.ok)(res, result);
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
async function webhook(req, res) {
    try {
        await (0, subscription_service_1.handleWebhook)(req.body);
        res.status(200).json({ received: true });
    }
    catch {
        res.status(200).json({ received: true });
    }
}
async function verifyTx(req, res) {
    try {
        (0, response_1.ok)(res, await (0, subscription_service_1.verifyTransaction)(req.params.txId));
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
// ── Confirmation simulée (sandbox / dev uniquement) ──────────────────────────
async function devConfirm(req, res) {
    if (env_1.env.IS_PROD) {
        (0, response_1.forbidden)(res, 'Non disponible en production');
        return;
    }
    try {
        const sub = await prisma_1.prisma.subscription.findUnique({ where: { userId: req.user.id } });
        if (!sub) {
            (0, response_1.badRequest)(res, 'Aucun abonnement en attente');
            return;
        }
        await prisma_1.prisma.subscription.update({
            where: { id: sub.id },
            data: { fedapayStatus: 'approved', expiresAt: new Date(Date.now() + 30 * 86400000) },
        });
        (0, response_1.ok)(res, { approved: true }, 'Paiement simulé avec succès');
    }
    catch {
        (0, response_1.serverError)(res);
    }
}
function getPlans(_req, res) {
    (0, response_1.ok)(res, {
        plans: [
            { key: 'DECOUVERTE', label: 'Découverte', amount: env_1.env.PLAN_PRICE_DECOUVERTE, currency: 'FCFA', durationDays: 30 },
            { key: 'STANDARD', label: 'Standard', amount: env_1.env.PLAN_PRICE_STANDARD, currency: 'FCFA', durationDays: 30 },
            { key: 'PREMIUM', label: 'Premium', amount: env_1.env.PLAN_PRICE_PREMIUM, currency: 'FCFA', durationDays: 30 },
        ],
    });
}
//# sourceMappingURL=subscription.controller.js.map