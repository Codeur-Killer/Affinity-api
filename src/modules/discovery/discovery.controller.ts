import { Request, Response } from 'express';
import {
  getCandidates,
  getReceivedLikes,
  likeUser,
  passUser,
  deletePass,
  respondToLike,
} from './discovery.service';
import { getAccessStatus } from '../subscription/plan-limits';
import { ok, badRequest, serverError } from '../../utils/response';

export async function candidates(req: Request, res: Response): Promise<void> {
  try {
    const access       = await getAccessStatus(req.user!.id);
    const reset        = req.query.reset === 'true';
    const gender       = req.query.gender       as string | undefined;
    const maxDistance  = req.query.maxDistance  ? Number(req.query.maxDistance) : undefined;
    // Filtres avancés réservés aux plans Standard/Premium
    const minAge       = access.limits.advancedFilters && req.query.minAge
      ? Number(req.query.minAge) : undefined;
    const maxAge        = access.limits.advancedFilters && req.query.maxAge
      ? Number(req.query.maxAge) : undefined;
    const neighborhood  = access.limits.advancedFilters
      ? req.query.neighborhood as string | undefined : undefined;

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
    const isSuperLike = req.body?.isSuperLike === true;
    const result = await likeUser(req.user!.id, req.params.userId, isSuperLike);
    ok(res, result, result.isMatch ? 'C\'est un match !' : 'Like envoyé');
  } catch (err: unknown) {
    badRequest(res, err instanceof Error ? err.message : 'Erreur');
  }
}

export async function pass(req: Request, res: Response): Promise<void> {
  try {
    await passUser(req.user!.id, req.params.userId);
    ok(res, null, 'Profil passé');
  } catch (err: unknown) {
    badRequest(res, err instanceof Error ? err.message : 'Erreur');
  }
}

export async function undoPass(req: Request, res: Response): Promise<void> {
  try {
    await deletePass(req.user!.id, req.params.userId);
    ok(res, null, 'Annulé');
  } catch {
    serverError(res);
  }
}

export async function likeRespond(req: Request, res: Response): Promise<void> {
  try {
    const { likerId, accept } = req.body as { likerId: string; accept: boolean };
    if (!likerId) { badRequest(res, 'likerId requis'); return; }
    const result = await respondToLike(req.user!.id, likerId, accept);
    ok(res, result, accept ? (result.isMatch ? 'C\'est un match !' : 'Like envoyé') : 'Refusé');
  } catch (err: unknown) {
    badRequest(res, err instanceof Error ? err.message : 'Erreur');
  }
}
