import axios, { AxiosInstance } from 'axios';
import { prisma }               from '../../config/prisma';
import { env }                  from '../../config/env';
import { Subscription, Plan }   from '@prisma/client';

// ── Config plans ──────────────────────────────────────────────────────────────

const PLANS: Record<Plan, { label: string; amount: number; durationDays: number }> = {
  DECOUVERTE: { label: 'Découverte', amount: env.PLAN_PRICE_DECOUVERTE, durationDays: 30 },
  STANDARD:   { label: 'Standard',   amount: env.PLAN_PRICE_STANDARD,   durationDays: 30 },
  PREMIUM:    { label: 'Premium',    amount: env.PLAN_PRICE_PREMIUM,     durationDays: 30 },
};

// ── Client HTTP FedaPay ───────────────────────────────────────────────────────

const fedapay: AxiosInstance = axios.create({
  baseURL: env.IS_PROD
    ? 'https://api.fedapay.com/v1'
    : 'https://sandbox-api.fedapay.com/v1',
  headers: {
    Authorization:  `Bearer ${env.FEDAPAY_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ── Types internes ────────────────────────────────────────────────────────────

interface FedaTransaction {
  id:     number;
  status: string;
  amount: number;
}

interface FedaToken {
  token: string;
  url:   string;
}

// ── Types publics ─────────────────────────────────────────────────────────────

interface CustomerInfo { email: string; firstname: string; lastname: string; }

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
  customer: CustomerInfo;
}

export interface MobilePayResult {
  transactionId: string;
  status:        string;
  message:       string;
  plan:          Plan;
  amount:        number;
  checkoutUrl?:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTogoPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local  = digits.startsWith('228') ? digits.slice(3) : digits;
  return `+228${local}`;
}

async function createTransaction(
  planInfo: { label: string; amount: number },
  customer: CustomerInfo,
  phone?: string,
): Promise<FedaTransaction> {
  const body: Record<string, unknown> = {
    description:  `Affinity ${planInfo.label} — 30 jours`,
    amount:       planInfo.amount,
    currency:     { iso: 'XOF' },
    callback_url: `${env.API_URL}/api/subscription/webhook`,
    customer: {
      firstname: customer.firstname,
      lastname:  customer.lastname,
      email:     customer.email,
      ...(phone ? { phone_number: { number: phone, country: 'TG' } } : {}),
    },
  };
  const resp = await fedapay.post<{ 'v1/transaction': FedaTransaction }>('/transactions', body);
  return resp.data['v1/transaction'];
}

async function fetchTransaction(id: string): Promise<FedaTransaction> {
  const resp = await fedapay.get<{ 'v1/transaction': FedaTransaction }>(`/transactions/${id}`);
  return resp.data['v1/transaction'];
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getCurrentSubscription(userId: string): Promise<Subscription | null> {
  return prisma.subscription.findUnique({ where: { userId } });
}

const BOOST_DURATION_MS = 3 * 60 * 60 * 1000;

export async function activateBoost(userId: string): Promise<{ activeUntil: Date }> {
  const expiresAt = new Date(Date.now() + BOOST_DURATION_MS);
  await prisma.boost.create({ data: { userId, expiresAt } });
  return { activeUntil: expiresAt };
}

// Paiement Mobile Money direct — envoie une demande USSD push (T-Money / Flooz)
export async function payMobileMoney(input: MobilePayInput): Promise<MobilePayResult> {
  const { userId, plan, phone, customer } = input;
  const planInfo = PLANS[plan];
  if (!planInfo) throw new Error('Plan invalide');

  const formattedPhone = toTogoPhone(phone);

  const tx = await createTransaction(planInfo, customer, formattedPhone);

  // Déclencher le débit USSD sur le téléphone du client
  await fedapay.post(`/transactions/${tx.id}/pay`, {
    phone_number: { number: formattedPhone, country: 'TG' },
  });

  const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
  await prisma.subscription.upsert({
    where:  { userId },
    update: { plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt },
    create: { userId, plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt },
  });

  return {
    transactionId: String(tx.id),
    status:        'pending',
    message:       'Confirmez le paiement sur votre téléphone (notification USSD)',
    plan,
    amount:        planInfo.amount,
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

  if (sub.fedapayStatus === 'approved') {
    return { status: 'approved', approved: true, plan: sub.plan };
  }

  try {
    const tx       = await fetchTransaction(sub.fedapayTxId);
    const approved = tx.status === 'approved';

    if (approved) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data:  {
          fedapayStatus: 'approved',
          expiresAt:     new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
        },
      });
    }

    return { status: tx.status, approved, plan: sub.plan };
  } catch {
    return { status: sub.fedapayStatus ?? 'pending', approved: false, plan: sub.plan };
  }
}

// Checkout web — retourne l'URL de paiement hébergée FedaPay
export async function createCheckout(
  userId:   string,
  plan:     Plan,
  customer: CustomerInfo,
): Promise<CheckoutResult> {
  const planInfo = PLANS[plan];
  if (!planInfo) throw new Error('Plan invalide');

  const tx = await createTransaction(planInfo, customer);

  // Générer le token de la page de paiement hébergée
  const tokenResp = await fedapay.get<FedaToken>(`/transactions/${tx.id}/token`);
  const paymentUrl = tokenResp.data.url;

  const expiresAt = new Date(Date.now() + planInfo.durationDays * 86400000);
  await prisma.subscription.upsert({
    where:  { userId },
    update: { plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt },
    create: { userId, plan, fedapayTxId: String(tx.id), fedapayStatus: 'pending', expiresAt },
  });

  return { transactionId: String(tx.id), paymentUrl, plan, amount: planInfo.amount };
}

// Vérification directe d'une transaction par son ID
export async function verifyTransaction(txId: string): Promise<{
  status:   string;
  approved: boolean;
}> {
  const tx = await fetchTransaction(txId);
  return { status: tx.status, approved: tx.status === 'approved' };
}

// Webhook FedaPay (callback_url) — activé à chaque changement de statut
export async function handleWebhook(payload: Record<string, unknown>): Promise<void> {
  const event = payload as {
    name?:   string;
    object?: { id?: number; status?: string };
  };

  if (event.name !== 'transaction.updated') return;

  const txId   = event.object?.id;
  const status = event.object?.status ?? '';
  if (!txId) return;

  const sub = await prisma.subscription.findFirst({ where: { fedapayTxId: String(txId) } });
  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data:  {
      fedapayStatus: status,
      ...(status === 'approved' && {
        expiresAt: new Date(Date.now() + (PLANS[sub.plan]?.durationDays ?? 30) * 86400000),
      }),
    },
  });
}
