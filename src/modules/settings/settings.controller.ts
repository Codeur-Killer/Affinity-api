import { Request, Response } from 'express';
import { getSettings, updateSettings, updateFcmToken } from './settings.service';
import { ok, badRequest, serverError } from '../../utils/response';

export async function get(req: Request, res: Response): Promise<void> {
  try {
    const settings = await getSettings(req.user!.id);
    ok(res, settings);
  } catch {
    serverError(res);
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const settings = await updateSettings(req.user!.id, req.body);
    ok(res, settings, 'Paramètres mis à jour');
  } catch {
    serverError(res);
  }
}

export async function patchFcmToken(req: Request, res: Response): Promise<void> {
  try {
    const { fcmToken } = req.body as { fcmToken: string };
    if (!fcmToken) {
      badRequest(res, 'fcmToken requis');
      return;
    }
    await updateFcmToken(req.user!.id, fcmToken);
    ok(res, null, 'Token FCM enregistré');
  } catch {
    serverError(res);
  }
}
