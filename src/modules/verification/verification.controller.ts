import { Request, Response } from 'express';
import { submitIdCard, submitSelfie, getVerificationStatus } from './verification.service';
import { uploadFileToCloud } from '../../middleware/upload.middleware';
import { ok, badRequest, serverError } from '../../utils/response';

export async function uploadIdCard(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as { [f: string]: Express.Multer.File[] } | undefined;
    const front = files?.['idFront']?.[0];
    const back  = files?.['idBack']?.[0];

    console.log('[verification/id-card] files reçus:', {
      idFront: front ? `${front.originalname} (${front.size} bytes)` : 'manquant',
      idBack:  back  ? `${back.originalname}  (${back.size} bytes)` : 'manquant',
    });

    if (!front || !back) {
      badRequest(res, 'idFront et idBack sont requis');
      return;
    }

    const [frontUrl, backUrl] = await Promise.all([
      uploadFileToCloud(front, 'affinity/verification'),
      uploadFileToCloud(back,  'affinity/verification'),
    ]);

    console.log('[verification/id-card] uploadés →', frontUrl, backUrl);

    const verification = await submitIdCard(req.user!.id, frontUrl, backUrl);
    ok(res, verification, "Carte d'identité soumise avec succès");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur upload';
    console.error('[verification/id-card] ERREUR:', msg);
    serverError(res, msg);
  }
}

export async function uploadSelfie(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as { [f: string]: Express.Multer.File[] } | undefined;
    const file  = files?.['selfie']?.[0];

    console.log('[verification/selfie] fichier reçu:',
      file ? `${file.originalname} (${file.size} bytes)` : 'manquant');

    if (!file) {
      badRequest(res, 'Selfie requis');
      return;
    }

    const selfieUrl   = await uploadFileToCloud(file, 'affinity/verification');
    console.log('[verification/selfie] uploadé →', selfieUrl);

    const verification = await submitSelfie(req.user!.id, selfieUrl);
    ok(res, verification, 'Selfie soumis avec succès');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur upload';
    console.error('[verification/selfie] ERREUR:', msg);
    serverError(res, msg);
  }
}

export async function status(req: Request, res: Response): Promise<void> {
  try {
    const verification = await getVerificationStatus(req.user!.id);
    ok(res, verification ?? { status: 'NOT_SUBMITTED' });
  } catch { serverError(res); }
}
