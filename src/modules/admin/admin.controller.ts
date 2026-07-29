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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : undefined;
    serverError(res, msg);
  }
}

export async function subscriptions(req: Request, res: Response): Promise<void> {
  try {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    ok(res, await svc.getSubscriptions(page, limit));
  } catch { serverError(res); }
}

// ── Administrateurs ───────────────────────────────────────────────────────────

export async function listAdmins(_req: Request, res: Response): Promise<void> {
  try { ok(res, await svc.listAdmins()); }
  catch { serverError(res); }
}

export async function createAdmin(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, displayName } = req.body as { email?: string; password?: string; displayName?: string };
    if (!email || !password) { badRequest(res, 'email et password requis'); return; }
    if (password.length < 6) { badRequest(res, 'Mot de passe trop court (min 6 caractères)'); return; }
    ok(res, await svc.createAdmin(email, password, displayName), 'Compte administrateur créé');
  } catch (e: unknown) {
    badRequest(res, e instanceof Error ? e.message : 'Erreur création admin');
  }
}

export async function removeAdmin(req: Request, res: Response): Promise<void> {
  try {
    ok(res, await svc.removeAdmin(req.params.userId, req.user!.id), 'Droits admin retirés');
  } catch (e: unknown) {
    badRequest(res, e instanceof Error ? e.message : 'Erreur');
  }
}

// ── Retraits VIP ──────────────────────────────────────────────────────────────

export async function listVipWithdrawals(req: Request, res: Response): Promise<void> {
  try {
    const status = req.query.status as string | undefined;
    ok(res, await svc.listVipWithdrawals(status));
  } catch { serverError(res); }
}

export async function reviewWithdrawal(req: Request, res: Response): Promise<void> {
  try {
    const { status, note } = req.body as { status?: string; note?: string };
    if (status !== 'approved' && status !== 'rejected') {
      badRequest(res, 'status doit être "approved" ou "rejected"');
      return;
    }
    ok(res, await svc.reviewWithdrawal(req.params.id, status, note),
      status === 'approved' ? 'Retrait approuvé' : 'Retrait rejeté');
  } catch (e: unknown) {
    badRequest(res, e instanceof Error ? e.message : 'Erreur');
  }
}

// ── VIP ───────────────────────────────────────────────────────────────────────

export async function listVips(_req: Request, res: Response): Promise<void> {
  try { ok(res, await svc.listVips()); }
  catch { serverError(res); }
}

export async function createVip(req: Request, res: Response): Promise<void> {
  try {
    const { userId, vipCode } = req.body as { userId?: string; vipCode?: string };
    if (!userId || !vipCode) { badRequest(res, 'userId et vipCode requis'); return; }
    ok(res, await svc.createVip(userId, vipCode), 'Compte VIP créé');
  } catch (e: unknown) {
    badRequest(res, e instanceof Error ? e.message : 'Erreur création VIP');
  }
}

export async function updateVip(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body as { vipCode?: string; isVip?: boolean };
    ok(res, await svc.updateVip(req.params.userId, data), 'Compte VIP mis à jour');
  } catch (e: unknown) {
    badRequest(res, e instanceof Error ? e.message : 'Erreur mise à jour VIP');
  }
}

export async function revokeVip(req: Request, res: Response): Promise<void> {
  try {
    ok(res, await svc.revokeVip(req.params.userId), 'Statut VIP révoqué');
  } catch (e: unknown) {
    badRequest(res, e instanceof Error ? e.message : 'Erreur révocation VIP');
  }
}
