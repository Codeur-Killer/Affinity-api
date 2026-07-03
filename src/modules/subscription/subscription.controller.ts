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
} from './subscription.service';
import { getAccessStatus } from './plan-limits';
import { ok, badRequest, forbidden, serverError } from '../../utils/response';
import { prisma } from '../../config/prisma';

const VALID_PLANS: Plan[] = ['DECOUVERTE', 'STANDARD', 'PREMIUM'];

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
    const { plan } = req.body as { plan: string };
    if (!VALID_PLANS.includes(plan as Plan)) {
      badRequest(res, `Plan invalide. Valeurs : ${VALID_PLANS.join(', ')}`);
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }, include: { profile: true },
    });
    if (!user) { badRequest(res, 'Utilisateur introuvable'); return; }

    const customer = {
      email:     user.email ?? `user_${user.id}@affinity.app`,
      firstname: (user as any).profile?.firstName ?? 'Utilisateur',
      lastname:  (user as any).profile?.lastName  ?? 'Affinity',
    };
    const result = await createCheckout(req.user!.id, plan as Plan, customer);
    ok(res, result, 'Lien de paiement créé');
  } catch (err: unknown) {
    serverError(res, err instanceof Error ? err.message : 'Erreur paiement');
  }
}

// ── Paiement Mobile Money direct (T-Money / Flooz) ──────────────────────────
export async function mobilePay(req: Request, res: Response): Promise<void> {
  try {
    const { plan, phone, network } = req.body as {
      plan:    string;
      phone:   string;
      network: string;
    };

    if (!VALID_PLANS.includes(plan as Plan)) {
      badRequest(res, `Plan invalide. Valeurs : ${VALID_PLANS.join(', ')}`);
      return;
    }
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      badRequest(res, 'Numéro de téléphone invalide');
      return;
    }
    if (!network) {
      badRequest(res, 'Réseau requis (tm_money, flooz, mtn)');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }, include: { profile: true },
    });
    if (!user) { badRequest(res, 'Utilisateur introuvable'); return; }

    const result = await payMobileMoney({
      userId:   req.user!.id,
      plan:     plan as Plan,
      phone,
      network,
      customer: {
        email:     user.email ?? `user_${user.id}@affinity.app`,
        firstname: (user as any).profile?.firstName ?? 'Utilisateur',
        lastname:  (user as any).profile?.lastName  ?? 'Affinity',
      },
    });

    ok(res, result, result.message);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur paiement mobile';
    serverError(res, msg);
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
