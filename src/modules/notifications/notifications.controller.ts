import { Request, Response } from 'express';
import { getNotifications, markOneRead, markAllRead } from './notifications.service';
import { ok, notFound, serverError } from '../../utils/response';

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const result = await getNotifications(req.user!.id, page);
    ok(res, result);
  } catch {
    serverError(res);
  }
}

export async function readOne(req: Request, res: Response): Promise<void> {
  try {
    const done = await markOneRead(req.params.id, req.user!.id);
    if (!done) {
      notFound(res, 'Notification introuvable');
      return;
    }
    ok(res, null, 'Notification marquée comme lue');
  } catch {
    serverError(res);
  }
}

export async function readAll(req: Request, res: Response): Promise<void> {
  try {
    await markAllRead(req.user!.id);
    ok(res, null, 'Toutes les notifications ont été lues');
  } catch {
    serverError(res);
  }
}
