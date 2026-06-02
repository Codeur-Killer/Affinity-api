"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscription = getSubscription;
exports.checkout = checkout;
exports.mobilePay = mobilePay;
exports.mobilePayStatus = mobilePayStatus;
exports.webhook = webhook;
exports.verifyTx = verifyTx;
const subscription_service_1 = require("./subscription.service");
const response_1 = require("../../utils/response");
const prisma_1 = require("../../config/prisma");
const VALID_PLANS = ['DECOUVERTE', 'STANDARD', 'PREMIUM'];
async function getSubscription(req, res) {
    try {
        const sub = await (0, subscription_service_1.getCurrentSubscription)(req.user.id);
        const isActive = sub ? sub.expiresAt > new Date() && sub.fedapayStatus === 'approved' : false;
        (0, response_1.ok)(res, { subscription: sub, isActive });
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
//# sourceMappingURL=subscription.controller.js.map