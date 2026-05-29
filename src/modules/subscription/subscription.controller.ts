import { Request, Response } from 'express';
import { Plan } from '@prisma/client';
import {
  getCurrentSubscription,
  createCheckout,
  handleWebhook,
  verifyTransaction,
} from './subscription.service';
import { ok, badRequest, serverError } from '../../utils/response';
import { prisma } from '../../config/prisma';

const VALID_PLANS: Plan[] = ['DECOUVERTE', 'STANDARD', 'PREMIUM'];

export async function getSubscription(req: Request, res: Response): Promise<void> {
  try {
    const sub = await getCurrentSubscription(req.user!.id);
    const isActive = sub ? sub.expiresAt > new Date() && sub.fedapayStatus === 'approved' : false;
    ok(res, { subscription: sub, isActive });
  } catch {
    serverError(res);
  }
}

export async function checkout(req: Request, res: Response): Promise<void> {
  try {
    const { plan } = req.body as { plan: string };

    if (!VALID_PLANS.includes(plan as Plan)) {
      badRequest(res, `Plan invalide. Valeurs acceptées : ${VALID_PLANS.join(', ')}`);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true },
    });

    if (!user) {
      badRequest(res, 'Utilisateur introuvable');
      return;
    }

    const customer = {
      email: user.email ?? `user_${user.id}@affinity.app`,
      firstname: (user as unknown as { profile?: { firstName?: string } }).profile?.firstName ?? 'Utilisateur',
      lastname: (user as unknown as { profile?: { lastName?: string } }).profile?.lastName ?? 'Affinity',
    };

    const result = await createCheckout(req.user!.id, plan as Plan, customer);
    ok(res, result, 'Lien de paiement créé');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur lors du paiement';
    serverError(res, msg);
  }
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
  try {
    const result = await verifyTransaction(req.params.txId);
    ok(res, result);
  } catch {
    serverError(res);
  }
}
