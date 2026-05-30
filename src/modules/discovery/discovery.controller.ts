import { Request, Response } from 'express';
import { getCandidates, likeUser, passUser, respondToLike } from './discovery.service';
import { ok, badRequest, serverError } from '../../utils/response';

export async function candidates(req: Request, res: Response): Promise<void> {
  try {
    const profiles = await getCandidates(req.user!.id);
    ok(res, { candidates: profiles, count: profiles.length });
  } catch { serverError(res); }
}

export async function like(req: Request, res: Response): Promise<void> {
  try {
    const result = await likeUser(req.user!.id, req.params.userId);
    ok(res, result, 'Like envoyé');
  } catch (err: unknown) {
    badRequest(res, err instanceof Error ? err.message : 'Erreur');
  }
}

export async function pass(req: Request, res: Response): Promise<void> {
  try {
    await passUser(req.user!.id, req.params.userId);
    ok(res, null, 'Profil passé');
  } catch { serverError(res); }
}

export async function respondLike(req: Request, res: Response): Promise<void> {
  try {
    const { likerId, accept } = req.body as { likerId: string; accept: boolean };
    if (!likerId) { badRequest(res, 'likerId requis'); return; }

    const result = await respondToLike(req.user!.id, likerId, accept);
    ok(res, result, accept ? 'Match créé !' : 'Like refusé');
  } catch (err: unknown) {
    badRequest(res, err instanceof Error ? err.message : 'Erreur');
  }
}
