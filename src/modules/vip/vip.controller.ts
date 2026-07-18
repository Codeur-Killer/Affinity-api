import { Request, Response } from 'express';
import * as svc from './vip.service';
import { ok, serverError } from '../../utils/response';

export async function dashboard(req: Request, res: Response): Promise<void> {
  try { ok(res, await svc.getVipDashboard(req.user!.id)); }
  catch (e: unknown) {
    serverError(res, e instanceof Error ? e.message : 'Erreur tableau de bord VIP');
  }
}
