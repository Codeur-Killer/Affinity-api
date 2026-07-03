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
exports.handleWebhook = handleWebhook;
exports.verifyTransaction = verifyTransaction;
exports.payMobileMoney = payMobileMoney;
exports.checkMobilePayStatus = checkMobilePayStatus;
const axios_1 = __importStar(require("axios"));
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const PLANS = {
    DECOUVERTE: { label: 'Découverte', amount: 5000, durationDays: 30 },
    STANDARD: { label: 'Standard', amount: 15000, durationDays: 30 },
    PREMIUM: { label: 'Premium', amount: 25000, durationDays: 30 },
};
const isSandbox = env_1.env.FEDAPAY_SECRET_KEY.startsWith('sk_sandbox_');
// URL auto-détectée d'après la clé — plus besoin de changer FEDAPAY_BASE_URL manuellement
const FEDAPAY_BASE_URL = isSandbox
    ? 'https://sandbox-api.fedapay.com'
    : 'https://api.fedapay.com';
// Log de debug au démarrage
const _keyPreview = env_1.env.FEDAPAY_SECRET_KEY.length > 8
    ? `${env_1.env.FEDAPAY_SECRET_KEY.slice(0, 12)}...${env_1.env.FEDAPAY_SECRET_KEY.slice(-4)}`
    : '(VIDE ou trop courte)';
console.log(`[FedaPay] Clé : ${_keyPreview} | Mode: ${isSandbox ? 'SANDBOX' : '🟢 LIVE'} | URL: ${FEDAPAY_BASE_URL}`);
const fedapayHeaders = () => ({
    Authorization: `Bearer ${env_1.env.FEDAPAY_SECRET_KEY.trim()}`, // trim() au cas où espaces parasites
    'Content-Type': 'application/json',
    Accept: 'application/json',
});
// ── Extrait le vrai objet transaction de la réponse FedaPay ──────────────────
// FedaPay retourne { "v1/transaction": {...} } (clé avec slash)
function parseTx(data) {
    if (!data || typeof data !== 'object')
        return null;
    const d = data;
    // Format réel : { "v1/transaction": { id, payment_url, ... } }
    const bySlashKey = d['v1/transaction'];
    if (bySlashKey?.id)
        return bySlashKey;
    // Formats alternatifs (au cas où)
    const byV1 = d.v1?.transaction;
    if (byV1?.id)
        return byV1;
    if (d.transaction)
        return d.transaction;
    if (d.id)
        return d;
    return null;
}
// ── Construit l'URL de checkout FedaPay (fallback si payment_url absent) ─────
function buildCheckoutUrl(tokenOrId) {
    const base = isSandbox
        ? 'https://sandbox-process.fedapay.com' // URL réelle sandbox
        : 'https://process.fedapay.com';
    return `${base}/payment-page/${tokenOrId}`;
}
// ── PUBLIC API ─────────────────────────────────────────────────────────────────
async function getCurrentSubscription(userId) {
    return prisma_1.prisma.subscription.findUnique({ where: { userId } });
}
const BOOST_DURATION_MS = 3 * 60 * 60 * 1000; // 3 heures
async function activateBoost(userId) {
    const expiresAt = new Date(Date.now() + BOOST_DURATION_MS);
    await prisma_1.prisma.boost.create({ data: { userId, expiresAt } });
    return { activeUntil: expiresAt };
}
async function createCheckout(userId, plan, customer) {
    const planInfo = PLANS[plan];
    if (!planInfo)
        throw new Error('Plan invalide');
    const callbackUrl = `${env_1.env.API_URL}/api/subscription/webhook`;
    // return_url = URL interceptée par le WebView Flutter pour détecter la fin du paiement
    const returnUrl = `${env_1.env.API_URL}/api/subscription/result?status=success&plan=${plan}`;
    // 1. Créer la transaction
    let txId;
    try {
        const res = await axios_1.default.post(`${FEDAPAY_BASE_URL}/v1/transactions`, {
            description: `Abonnement Affinity ${planInfo.label}`,
            amount: planInfo.amount,
            currency: { iso: 'XOF' },
            customer: {
                email: customer.email,
                firstname: customer.firstname,
                lastname: customer.lastname,
            },
            callback_url: callbackUrl,
            return_url: returnUrl,
            additional_details: `userId=${userId}&plan=${plan}`,
        }, { headers: fedapayHeaders(), timeout: 20000 });
        const tx = parseTx(res.data);
        if (!tx?.id) {
            console.error('[FedaPay] Réponse:', JSON.stringify(res.data).substring(0, 300));
            throw new Error('FedaPay: aucun ID de transaction reçu');
        }
        txId = tx.id;
        // ✅ FedaPay retourne payment_url directement dans la réponse de création
        const directUrl = tx.payment_url;
        console.log('[FedaPay] Transaction créée:', txId, '| payment_url:', directUrl ?? '(absent)');
        if (directUrl || txId) {
            const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
            await prisma_1.prisma.subscription.upsert({
                where: { userId },
                update: { plan, fedapayTxId: String(txId), fedapayStatus: 'pending', expiresAt },
                create: { userId, plan, fedapayTxId: String(txId), fedapayStatus: 'pending', expiresAt },
            });
            // ✅ Utiliser notre page de paiement hébergée au lieu de sandbox-process.fedapay.com
            // (qui bloque les connexions depuis Android)
            const hostedUrl = `${env_1.env.API_URL}/payment?txId=${txId}&plan=${plan}&amount=${planInfo.amount}`;
            return { transactionId: txId, paymentUrl: hostedUrl, plan, amount: planInfo.amount };
        }
    }
    catch (e) {
        if (e instanceof axios_1.AxiosError) {
            const status = e.response?.status;
            const body = JSON.stringify(e.response?.data ?? e.message);
            console.error(`[FedaPay] Erreur création: HTTP ${status} – ${body}`);
            if (status === 401) {
                throw new Error(`Clé FedaPay invalide (401). URL: ${FEDAPAY_BASE_URL}. ` +
                    'Vérifiez FEDAPAY_SECRET_KEY sur app.fedapay.com → Paramètres → Clés API');
            }
            throw new Error(`FedaPay erreur ${status}: ${body}`);
        }
        throw e;
    }
    // 2. Fallback : appeler /token si payment_url n'était pas dans la réponse
    let paymentUrl;
    try {
        const tokenRes = await axios_1.default.post(`${FEDAPAY_BASE_URL}/v1/transactions/${txId}/token`, {}, { headers: fedapayHeaders(), timeout: 15000 });
        const td = tokenRes.data;
        const url = (td.payment_url ?? td.url ?? td.v1?.url);
        const token = (td.payment_token ?? td.token ?? td.v1?.token);
        paymentUrl = url ?? (token ? buildCheckoutUrl(token) : buildCheckoutUrl(String(txId)));
        console.log('[FedaPay] Token URL:', paymentUrl);
    }
    catch {
        paymentUrl = buildCheckoutUrl(String(txId));
    }
    // 3. Sauvegarder la transaction en attente en DB
    const expiresAt = new Date(Date.now() + planInfo.durationDays * 24 * 60 * 60 * 1000);
    await prisma_1.prisma.subscription.upsert({
        where: { userId },
        update: { plan, fedapayTxId: String(txId), fedapayStatus: 'pending', expiresAt },
        create: { userId, plan, fedapayTxId: String(txId), fedapayStatus: 'pending', expiresAt },
    });
    return { transactionId: txId, paymentUrl, plan, amount: planInfo.amount };
}
async function handleWebhook(payload) {
    // FedaPay envoie { name: "transaction.approved", data: { id, status, ... } }
    const txData = payload?.data;
    if (!txData)
        return;
    const txId = String(txData.id ?? '');
    const rawStatus = (txData.status ?? '').toLowerCase();
    if (!txId)
        return;
    const sub = await prisma_1.prisma.subscription.findFirst({ where: { fedapayTxId: txId } });
    if (!sub) {
        // Essayer de retrouver via additional_details
        const details = txData.additional_details;
        if (details) {
            const params = Object.fromEntries(new URLSearchParams(details));
            const uid = params['userId'];
            const plan = params['plan'];
            if (uid && plan) {
                const days = PLANS[plan]?.durationDays ?? 30;
                await prisma_1.prisma.subscription.upsert({
                    where: { userId: uid },
                    update: { plan, fedapayTxId: txId, fedapayStatus: rawStatus,
                        expiresAt: new Date(Date.now() + days * 86400000) },
                    create: { userId: uid, plan, fedapayTxId: txId, fedapayStatus: rawStatus,
                        expiresAt: new Date(Date.now() + days * 86400000) },
                });
            }
        }
        return;
    }
    const approved = rawStatus === 'approved' || rawStatus === 'transferred';
    await prisma_1.prisma.subscription.update({
        where: { id: sub.id },
        data: {
            fedapayStatus: rawStatus,
            ...(approved && {
                expiresAt: new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
            }),
        },
    });
}
async function verifyTransaction(txId) {
    const res = await axios_1.default.get(`${FEDAPAY_BASE_URL}/v1/transactions/${txId}`, { headers: fedapayHeaders(), timeout: 10000 });
    const tx = parseTx(res.data);
    const status = (tx?.status ?? 'unknown').toLowerCase();
    return { status, approved: status === 'approved' || status === 'transferred' };
}
async function payMobileMoney(input) {
    const { userId, plan, phone, network, customer } = input;
    const planInfo = PLANS[plan];
    if (!planInfo)
        throw new Error('Plan invalide');
    const callbackUrl = `${env_1.env.API_URL}/api/subscription/webhook`;
    // Normaliser le numéro (enlever le +228 si présent → FedaPay attend juste les chiffres)
    const normalizedPhone = phone.replace(/^\+228/, '').replace(/\D/g, '');
    // 1. Créer la transaction FedaPay
    const txRes = await axios_1.default.post(`${FEDAPAY_BASE_URL}/v1/transactions`, {
        description: `Abonnement Affinity ${planInfo.label}`,
        amount: planInfo.amount,
        currency: { iso: 'XOF' },
        customer: {
            email: customer.email,
            firstname: customer.firstname,
            lastname: customer.lastname,
            phone_number: { number: normalizedPhone, country: 'TG' },
        },
        callback_url: callbackUrl,
        additional_details: `userId=${userId}&plan=${plan}`,
    }, { headers: fedapayHeaders(), timeout: 20000, validateStatus: () => true });
    // Log complet pour debug
    console.log('[FedaPay Mobile] Création transaction — statut:', txRes.status, '| réponse:', JSON.stringify(txRes.data).slice(0, 300));
    if (txRes.status >= 400) {
        const body = txRes.data;
        const errors = body?.errors;
        // Extraire les erreurs de validation FedaPay (ex: montant max dépassé)
        const detail = errors
            ? Object.entries(errors).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' | ')
            : String(body?.message ?? 'Erreur inconnue');
        console.error('[FedaPay Mobile] Erreur création:', txRes.status, detail);
        throw new Error(detail);
    }
    const tx = parseTx(txRes.data);
    if (!tx?.id)
        throw new Error('FedaPay : aucun ID de transaction reçu');
    const txId = tx.id;
    console.log('[FedaPay Mobile] Transaction créée:', txId);
    // 2. Tenter l'initiation USSD directe (fonctionne avec les clés live, pas sandbox)
    let ussdInitiated = false;
    try {
        const payRes = await axios_1.default.post(`${FEDAPAY_BASE_URL}/v1/transactions/${txId}/pay`, {
            payment_method: network,
            phone_number: { number: normalizedPhone, country: 'TG' },
        }, { headers: fedapayHeaders(), timeout: 20000, validateStatus: () => true });
        if (payRes.status < 400) {
            ussdInitiated = true;
            console.log('[FedaPay Mobile] USSD initié, statut HTTP:', payRes.status);
        }
        else {
            console.log('[FedaPay Mobile] /pay non disponible (sandbox?):', payRes.status, JSON.stringify(payRes.data).slice(0, 150));
        }
    }
    catch (e) {
        console.log('[FedaPay Mobile] /pay exception (sandbox?):', String(e).slice(0, 100));
    }
    // 3. Sauvegarder en DB
    const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
    await prisma_1.prisma.subscription.upsert({
        where: { userId },
        update: { plan, fedapayTxId: String(txId), fedapayStatus: 'pending', expiresAt },
        create: { userId, plan, fedapayTxId: String(txId), fedapayStatus: 'pending', expiresAt },
    });
    if (ussdInitiated) {
        // Production : prompt USSD envoyé sur le téléphone
        return {
            transactionId: txId,
            status: 'pending',
            message: 'Confirmez le paiement sur votre téléphone (prompt USSD)',
            plan,
            amount: planInfo.amount,
        };
    }
    // Sandbox (ou clés live non encore activées) : retourner l'URL de checkout FedaPay
    const checkoutUrl = `${env_1.env.API_URL}/payment?txId=${txId}&plan=${plan}&amount=${planInfo.amount}`;
    console.log('[FedaPay Mobile] Fallback checkout URL:', checkoutUrl);
    return {
        transactionId: txId,
        status: 'pending',
        message: 'Ouvrez le lien pour finaliser le paiement Mobile Money',
        plan,
        amount: planInfo.amount,
        checkoutUrl,
    };
}
// Vérifier le statut d'un paiement mobile money (polling depuis Flutter)
async function checkMobilePayStatus(userId) {
    const sub = await prisma_1.prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.fedapayTxId)
        return { status: 'not_found', approved: false };
    try {
        const { status, approved } = await verifyTransaction(sub.fedapayTxId);
        if (approved && sub.fedapayStatus !== 'approved') {
            await prisma_1.prisma.subscription.update({
                where: { id: sub.id },
                data: { fedapayStatus: 'approved',
                    expiresAt: new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000) },
            });
        }
        return { status, approved, plan: sub.plan };
    }
    catch {
        return { status: sub.fedapayStatus ?? 'pending', approved: false, plan: sub.plan };
    }
}
//# sourceMappingURL=subscription.service.js.map