import { Request, Response } from 'express';
import { Plan } from '@prisma/client';
import {
  getCurrentSubscription,
  createCheckout,
  handleWebhook,
  verifyTransaction,
  payMobileMoney,
  checkMobilePayStatus,
  activateBoost,
  validateVipCode,
} from './subscription.service';
import { getAccessStatus } from './plan-limits';
import { ok, badRequest, forbidden, unauthorized, serverError } from '../../utils/response';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

const VALID_PLANS: Plan[] = ['DECOUVERTE', 'STANDARD', 'PREMIUM'];

// FedaPay ApiConnectionError n'étend pas Error — extraire le vrai message
function fedaMsg(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    // Erreurs de validation FedaPay : { errors: { field: ['msg'] } }
    if (e['errors'] && typeof e['errors'] === 'object') {
      const errs = e['errors'] as Record<string, string[]>;
      const first = Object.values(errs)[0];
      if (Array.isArray(first) && first[0]) return first[0];
    }
    if (typeof e['errorMessage'] === 'string' && e['errorMessage']) return e['errorMessage'];
    if (typeof e['message']      === 'string' && e['message'])      return e['message'];
  }
  return fallback;
}

export async function getSubscription(req: Request, res: Response): Promise<void> {
  try {
    const sub    = await getCurrentSubscription(req.user!.id);
    const access = await getAccessStatus(req.user!.id);
    ok(res, {
      subscription: sub,
      isActive:     access.isActive,
      plan:         access.plan,
      isVerified:   access.isVerified,
      canSwipe:     access.canSwipe,
      isVip:        access.isVip,
      limits:       access.limits,
      usage:        access.usage,
    });
  } catch { serverError(res); }
}

export async function boost(req: Request, res: Response): Promise<void> {
  try {
    const access = await getAccessStatus(req.user!.id);
    if (!access.isActive) {
      forbidden(res, 'Un abonnement actif est requis pour utiliser un boost');
      return;
    }
    const { boostsPerMonth } = access.limits;
    if (boostsPerMonth !== null && access.usage.boostsThisMonth >= boostsPerMonth) {
      forbidden(res, 'Limite de boosts mensuels atteinte pour votre plan');
      return;
    }
    const result = await activateBoost(req.user!.id);
    ok(res, result, 'Boost activé pour 3 heures');
  } catch { serverError(res); }
}

export async function checkout(req: Request, res: Response): Promise<void> {
  try {
    const { plan, vipCode } = req.body as { plan: string; vipCode?: string };
    if (!VALID_PLANS.includes(plan as Plan)) {
      badRequest(res, `Plan invalide. Valeurs : ${VALID_PLANS.join(', ')}`);
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }, include: { profile: true },
    });
    if (!user) { unauthorized(res, 'Session expirée. Reconnectez-vous.'); return; }

    const customer = {
      email:     user.email ?? `user_${user.id}@affinity.app`,
      firstname: (user as any).profile?.firstName ?? 'Utilisateur',
      lastname:  (user as any).profile?.lastName  ?? 'Affinity',
    };
    const result = await createCheckout(req.user!.id, plan as Plan, customer, vipCode);
    ok(res, result, 'Lien de paiement créé');
  } catch (err: unknown) {
    serverError(res, fedaMsg(err, 'Erreur création checkout'));
  }
}

// ── Paiement Mobile Money direct (T-Money / Flooz) ──────────────────────────
export async function validateCode(req: Request, res: Response): Promise<void> {
  try {
    const code = ((req.query.code as string) ?? '').trim().toUpperCase();
    if (!code) { badRequest(res, 'code requis'); return; }
    ok(res, await validateVipCode(code));
  } catch (e: unknown) {
    badRequest(res, e instanceof Error ? e.message : 'Code invalide');
  }
}

export async function mobilePay(req: Request, res: Response): Promise<void> {
  try {
    const { plan, phone, network, vipCode } = req.body as {
      plan:     string;
      phone:    string;
      network:  string;
      vipCode?: string;
    };

    if (!VALID_PLANS.includes(plan as Plan)) {
      badRequest(res, `Plan invalide. Valeurs : ${VALID_PLANS.join(', ')}`);
      return;
    }
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      badRequest(res, 'Numéro de téléphone invalide');
      return;
    }
    const VALID_NETWORKS = ['tm_money', 'flooz', 'mtn'];
    if (!network || !VALID_NETWORKS.includes(network)) {
      badRequest(res, `Réseau invalide. Valeurs acceptées : ${VALID_NETWORKS.join(', ')}`);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }, include: { profile: true },
    });
    if (!user) { unauthorized(res, 'Session expirée. Reconnectez-vous.'); return; }

    const result = await payMobileMoney({
      userId:   req.user!.id,
      plan:     plan as Plan,
      phone,
      network,
      vipCode,
      customer: {
        email:     user.email ?? `user_${user.id}@affinity.app`,
        firstname: (user as any).profile?.firstName ?? 'Utilisateur',
        lastname:  (user as any).profile?.lastName  ?? 'Affinity',
      },
    });

    ok(res, result, result.message);
  } catch (err: unknown) {
    serverError(res, fedaMsg(err, 'Erreur paiement mobile'));
  }
}

// ── Vérification statut (polling depuis Flutter) ─────────────────────────────
export async function mobilePayStatus(req: Request, res: Response): Promise<void> {
  try {
    const result = await checkMobilePayStatus(req.user!.id);
    ok(res, result);
  } catch { serverError(res); }
}

export async function webhook(req: Request, res: Response): Promise<void> {
  try {
    await handleWebhook(req.body as Record<string, unknown>);
    res.status(200).json({ received: true });
  } catch {
    res.status(200).json({ received: true });
  }
}

export async function verifyTx(req: Request, res: Response): Promise<void> {
  try { ok(res, await verifyTransaction(req.params.txId)); }
  catch { serverError(res); }
}

// ── Confirmation simulée (sandbox / dev uniquement) ──────────────────────────
export async function devConfirm(req: Request, res: Response): Promise<void> {
  if (env.IS_PROD) { forbidden(res, 'Non disponible en production'); return; }
  try {
    const sub = await prisma.subscription.findUnique({ where: { userId: req.user!.id } });
    if (!sub) { badRequest(res, 'Aucun abonnement en attente'); return; }
    await prisma.subscription.update({
      where: { id: sub.id },
      data:  { fedapayStatus: 'approved', expiresAt: new Date(Date.now() + 30 * 86400000) },
    });
    ok(res, { approved: true }, 'Paiement simulé avec succès');
  } catch { serverError(res); }
}

export function getPlans(_req: Request, res: Response): void {
  ok(res, {
    plans: [
      { key: 'DECOUVERTE', label: 'Découverte', amount: env.PLAN_PRICE_DECOUVERTE, currency: 'FCFA', durationDays: 30 },
      { key: 'STANDARD',   label: 'Standard',   amount: env.PLAN_PRICE_STANDARD,   currency: 'FCFA', durationDays: 30 },
      { key: 'PREMIUM',    label: 'Premium',    amount: env.PLAN_PRICE_PREMIUM,     currency: 'FCFA', durationDays: 30 },
    ],
  });
}
