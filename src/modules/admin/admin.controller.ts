import { Request, Response } from 'express';
import * as svc from './admin.service';
import { ok, badRequest, serverError } from '../../utils/response';

export async function stats(req: Request, res: Response): Promise<void> {
  try { ok(res, await svc.getStats()); }
  catch { serverError(res); }
}

export async function chart(req: Request, res: Response): Promise<void> {
  try { ok(res, await svc.getRegistrationChart()); }
  catch { serverError(res); }
}

export async function users(req: Request, res: Response): Promise<void> {
  try {
    const page   = parseInt(req.query.page   as string) || 1;
    const limit  = parseInt(req.query.limit  as string) || 20;
    const search = (req.query.search as string) || '';
    ok(res, await svc.getUsers(page, limit, search));
  } catch { serverError(res); }
}

export async function banUser(req: Request, res: Response): Promise<void> {
  try {
    const { banned } = req.body as { banned: boolean };
    ok(res, await svc.banUser(req.params.userId, banned),
      banned ? 'Utilisateur banni' : 'Utilisateur réactivé');
  } catch (e: unknown) {
    badRequest(res, e instanceof Error ? e.message : 'Erreur');
  }
}

export async function promoteUser(req: Request, res: Response): Promise<void> {
  try {
    const { isAdmin } = req.body as { isAdmin: boolean };
    ok(res, await svc.promoteUser(req.params.userId, isAdmin),
      isAdmin ? 'Promu administrateur' : 'Droits admin retirés');
  } catch { serverError(res); }
}

export async function verifications(req: Request, res: Response): Promise<void> {
  try {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    ok(res, await svc.getPendingVerifications(page, limit));
  } catch { serverError(res); }
}

export async function reviewVerification(req: Request, res: Response): Promise<void> {
  try {
    const { approved } = req.body as { approved: boolean };
    if (approved === undefined) { badRequest(res, 'approved requis'); return; }
    ok(res, await svc.reviewVerification(req.params.userId, approved),
      approved ? 'Profil vérifié ✓' : 'Vérification rejetée');
  } catch { serverError(res); }
}

export async function subscriptions(req: Request, res: Response): Promise<void> {
  try {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    ok(res, await svc.getSubscriptions(page, limit));
  } catch { serverError(res); }
}
