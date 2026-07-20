import { Request, Response } from 'express';
import { getMyMatches, getMatchById, unmatch } from './matches.service';
import { ok, notFound, forbidden, serverError } from '../../utils/response';

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const page   = req.query.page ? Number(req.query.page) : 1;
    const result = await getMyMatches(req.user!.id, page);
    ok(res, result);
  } catch {
    serverError(res);
  }
}

export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    const match = await getMatchById(req.params.matchId, req.user!.id);
    if (!match) {
      notFound(res, 'Match introuvable');
      return;
    }
    ok(res, match);
  } catch {
    serverError(res);
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const deleted = await unmatch(req.params.matchId, req.user!.id);
    if (!deleted) {
      forbidden(res, 'Action non autorisée');
      return;
    }
    ok(res, null, 'Match supprimé');
  } catch {
    serverError(res);
  }
}
