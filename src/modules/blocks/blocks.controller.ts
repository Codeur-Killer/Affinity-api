import { Request, Response } from 'express';
import { ok, badRequest } from '../../utils/response';
import { getBlockedUsers, blockUser, unblockUser } from './blocks.service';

export async function list(req: Request, res: Response) {
  ok(res, { blocks: await getBlockedUsers(req.user!.id) });
}

export async function block(req: Request, res: Response) {
  const { userId } = req.params;
  try {
    await blockUser(req.user!.id, userId);
    ok(res, { message: 'Utilisateur bloqué.' });
  } catch (e) {
    badRequest(res, e instanceof Error ? e.message : 'Erreur');
  }
}

export async function unblock(req: Request, res: Response) {
  await unblockUser(req.user!.id, req.params.userId);
  ok(res, { message: 'Utilisateur débloqué.' });
}
