import { Request, Response } from 'express';
import {
  getCandidates,
  getReceivedLikes,
  likeUser,
  passUser,
} from './discovery.service';
import { ok, badRequest, serverError } from '../../utils/response';

export async function candidates(req: Request, res: Response): Promise<void> {
  try {
    const reset        = req.query.reset === 'true';
    const gender       = req.query.gender       as string | undefined;
    const minAge       = req.query.minAge       ? Number(req.query.minAge)      : undefined;
    const maxAge       = req.query.maxAge       ? Number(req.query.maxAge)      : undefined;
    const maxDistance  = req.query.maxDistance  ? Number(req.query.maxDistance) : undefined;
    const neighborhood = req.query.neighborhood as string | undefined;

    const profiles = await getCandidates(req.user!.id, {
      reset, gender, minAge, maxAge, maxDistance, neighborhood,
    });
    ok(res, { candidates: profiles, count: profiles.length });
  } catch { serverError(res); }
}

export async function receivedLikes(req: Request, res: Response): Promise<void> {
  try {
    const likes = await getReceivedLikes(req.user!.id);
    ok(res, { likes, count: likes.length });
  } catch { serverError(res); }
}

export async function like(req: Request, res: Response): Promise<void> {
  try {
    const result = await likeUser(req.user!.id, req.params.userId);
    ok(res, result, result.isMatch ? 'C\'est un match !' : 'Like envoyé');
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
