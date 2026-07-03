import axios, { AxiosError } from 'axios';
import { randomUUID }       from 'crypto';
import { prisma }           from '../../config/prisma';
import { env }              from '../../config/env';
import { Subscription, Plan } from '@prisma/client';

// ── Config plans ──────────────────────────────────────────────────────────────

const PLANS: Record<Plan, { label: string; amount: number; durationDays: number }> = {
  DECOUVERTE: { label: 'Découverte', amount: env.PLAN_PRICE_DECOUVERTE, durationDays: 30 },
  STANDARD:   { label: 'Standard',   amount: env.PLAN_PRICE_STANDARD,   durationDays: 30 },
  PREMIUM:    { label: 'Premium',    amount: env.PLAN_PRICE_PREMIUM,     durationDays: 30 },
};

// ── CinetPay ──────────────────────────────────────────────────────────────────

const CINETPAY_API = 'https://api-checkout.cinetpay.com/v2';

// ID de transaction unique ≤ 20 caractères alphanum (exigence CinetPay)
function generateTxId(): string {
  return ('AF' + randomUUID().replace(/-/g, '')).slice(0, 20);
}

function cinetpayBase(txId: string, plan: Plan) {
  const planInfo = PLANS[plan];
  return {
    apikey:            env.CINETPAY_API_KEY,
    site_id:           env.CINETPAY_SITE_ID,
    transaction_id:    txId,
    amount:            planInfo.amount,
    currency:          'XOF',
    description:       `Abonnement Affinity ${planInfo.label}`,
    return_url:        `${env.API_URL}/api/subscription/result?status=success&plan=${plan}`,
    notify_url:        `${env.API_URL}/api/subscription/webhook`,
    customer_address:  'Lomé',
    customer_city:     'Lomé',
    customer_country:  'TG',
    customer_state:    'TG',
    customer_zip_code: '00228',
    channels:          'MOBILE_MONEY',
  };
}

// ── Types publics ─────────────────────────────────────────────────────────────

interface CinetPayCustomer { email: string; firstname: string; lastname: string; }

export interface CheckoutResult {
  transactionId: string;
  paymentUrl:    string;
  plan:          Plan;
  amount:        number;
}

export interface MobilePayInput {
  userId:   string;
  plan:     Plan;
  phone:    string;
  network:  string;
  customer: CinetPayCustomer;
}

export interface MobilePayResult {
  transactionId: string;
  status:        string;
  message:       string;
  plan:          Plan;
  amount:        number;
  checkoutUrl?:  string; // présent uniquement en non-production (bouton "Simuler")
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getCurrentSubscription(userId: string): Promise<Subscription | null> {
  return prisma.subscription.findUnique({ where: { userId } });
}

const BOOST_DURATION_MS = 3 * 60 * 60 * 1000; // 3 heures

export async function activateBoost(userId: string): Promise<{ activeUntil: Date }> {
  const expiresAt = new Date(Date.now() + BOOST_DURATION_MS);
  await prisma.boost.create({ data: { userId, expiresAt } });
  return { activeUntil: expiresAt };
}

// Checkout web — retourne une URL CinetPay (fallback ou usage admin)
export async function createCheckout(
  userId:   string,
  plan:     Plan,
  customer: CinetPayCustomer,
): Promise<CheckoutResult> {
  const planInfo = PLANS[plan];
  if (!planInfo) throw new Error('Plan invalide');

  const txId = generateTxId();

  let res;
  try {
    res = await axios.post(`${CINETPAY_API}/payment`, {
      ...cinetpayBase(txId, plan),
      customer_email:   customer.email,
      customer_name:    customer.firstname,
      customer_surname: customer.lastname,
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
  } catch (e) {
    if (e instanceof AxiosError) {
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
  await prisma.subscription.upsert({
    where:  { userId },
    update: { plan, fedapayTxId: txId, fedapayStatus: 'pending', expiresAt },
    create: { userId, plan, fedapayTxId: txId, fedapayStatus: 'pending', expiresAt },
  });

  return { transactionId: txId, paymentUrl: data.payment_url, plan, amount: planInfo.amount };
}

// Paiement Mobile Money direct (T-Money / Flooz) — prompt USSD sur le téléphone
export async function payMobileMoney(input: MobilePayInput): Promise<MobilePayResult> {
  const { userId, plan, phone, customer } = input;
  const planInfo = PLANS[plan];
  if (!planInfo) throw new Error('Plan invalide');

  // Normaliser le numéro (enlever +228 si présent)
  const normalizedPhone = phone.replace(/^\+228/, '').replace(/\D/g, '');
  const txId = generateTxId();

  console.log('[CinetPay Mobile] Initiation — txId:', txId, '| phone:', normalizedPhone, '| plan:', plan);

  let paymentUrl: string | undefined;

  try {
    const res = await axios.post(`${CINETPAY_API}/payment`, {
      ...cinetpayBase(txId, plan),
      customer_email:        customer.email,
      customer_name:         customer.firstname,
      customer_surname:      customer.lastname,
      customer_phone_number: `+228${normalizedPhone}`,
    }, {
      headers:        { 'Content-Type': 'application/json' },
      timeout:        30000,
      validateStatus: () => true,
    });

    console.log('[CinetPay Mobile] Réponse HTTP', res.status, ':', JSON.stringify(res.data).slice(0, 300));

    if (res.status >= 400) {
      throw new Error(res.data?.message ?? `Erreur CinetPay (${res.status})`);
    }

    paymentUrl = res.data?.data?.payment_url as string | undefined;
  } catch (e) {
    if (e instanceof AxiosError) {
      throw new Error(e.response?.data?.message ?? e.message);
    }
    throw e;
  }

  // Sauvegarder en DB
  const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
  await prisma.subscription.upsert({
    where:  { userId },
    update: { plan, fedapayTxId: txId, fedapayStatus: 'pending', expiresAt },
    create: { userId, plan, fedapayTxId: txId, fedapayStatus: 'pending', expiresAt },
  });

  return {
    transactionId: txId,
    status:        'pending',
    message:       'Confirmez le paiement sur votre téléphone',
    plan,
    amount:        planInfo.amount,
    // checkoutUrl uniquement en mode non-production (bouton "Simuler" Flutter)
    ...(!env.IS_PROD && paymentUrl ? { checkoutUrl: paymentUrl } : {}),
  };
}

// Polling statut depuis Flutter
export async function checkMobilePayStatus(userId: string): Promise<{
  status:   string;
  approved: boolean;
  plan?:    Plan;
}> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub?.fedapayTxId) return { status: 'not_found', approved: false };

  try {
    const { status, approved } = await verifyTransaction(sub.fedapayTxId);

    if (approved && sub.fedapayStatus !== 'approved') {
      await prisma.subscription.update({
        where: { id: sub.id },
        data:  {
          fedapayStatus: 'approved',
          expiresAt:     new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
        },
      });
    }
    return { status, approved, plan: sub.plan };
  } catch {
    return { status: sub.fedapayStatus ?? 'pending', approved: false, plan: sub.plan };
  }
}

// Vérifier une transaction CinetPay
export async function verifyTransaction(txId: string): Promise<{
  status:   string;
  approved: boolean;
}> {
  const res = await axios.post(`${CINETPAY_API}/payment/check`, {
    apikey:         env.CINETPAY_API_KEY,
    site_id:        env.CINETPAY_SITE_ID,
    transaction_id: txId,
  }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

  const code     = String(res.data?.code ?? '');
  const status   = String(res.data?.data?.status ?? 'PENDING').toUpperCase();
  const approved = code === '00' || status === 'ACCEPTED';

  return { status, approved };
}

// Webhook CinetPay (notify_url)
export async function handleWebhook(payload: Record<string, unknown>): Promise<void> {
  // CinetPay envoie : cpm_trans_id, cpm_trans_status (ACCEPTED/REFUSED/CANCELLED)
  const txId      = String(payload.cpm_trans_id ?? payload.transaction_id ?? '');
  const rawStatus = String(payload.cpm_trans_status ?? payload.status ?? '').toUpperCase();

  if (!txId) return;

  const approved = rawStatus === 'ACCEPTED';
  const sub = await prisma.subscription.findFirst({ where: { fedapayTxId: txId } });
  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data:  {
      fedapayStatus: rawStatus.toLowerCase(),
      ...(approved && {
        expiresAt: new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
      }),
    },
  });

  console.log(`[CinetPay Webhook] tx=${txId} status=${rawStatus} plan=${sub.plan}`);
}
