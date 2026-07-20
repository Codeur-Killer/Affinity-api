import { Request, Response } from 'express';
import * as svc from './vip.service';
import { ok, badRequest, serverError } from '../../utils/response';

export async function dashboard(req: Request, res: Response): Promise<void> {
  try { ok(res, await svc.getVipDashboard(req.user!.id)); }
  catch (e: unknown) {
    serverError(res, e instanceof Error ? e.message : 'Erreur tableau de bord VIP');
  }
}

export async function requestWithdrawal(req: Request, res: Response): Promise<void> {
  try {
    const { amount } = req.body as { amount?: number };
    if (!amount) { badRequest(res, 'Montant requis'); return; }
    ok(res, await svc.requestWithdrawal(req.user!.id, Number(amount)), 'Demande de retrait soumise');
  } catch (e: unknown) {
    badRequest(res, e instanceof Error ? e.message : 'Erreur demande de retrait');
  }
}

export async function myWithdrawals(req: Request, res: Response): Promise<void> {
  try { ok(res, await svc.getMyWithdrawals(req.user!.id)); }
  catch { serverError(res); }
}
