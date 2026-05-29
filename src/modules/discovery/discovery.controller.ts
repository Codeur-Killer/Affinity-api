import { Request, Response } from 'express';
import { getCandidates, likeUser, passUser } from './discovery.service';
import { ok, badRequest, serverError } from '../../utils/response';

export async function candidates(req: Request, res: Response): Promise<void> {
  try {
    const profiles = await getCandidates(req.user!.id);
    ok(res, { candidates: profiles, count: profiles.length });
  } catch {
    serverError(res);
  }
}

export async function like(req: Request, res: Response): Promise<void> {
  try {
    const result = await likeUser(req.user!.id, req.params.userId);
    ok(res, result, result.isMatch ? 'Match !' : 'Like envoyé');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur';
    badRequest(res, message);
  }
}

export async function pass(req: Request, res: Response): Promise<void> {
  try {
    await passUser(req.user!.id, req.params.userId);
    ok(res, null, 'Profil passé');
  } catch {
    serverError(res);
  }
}
