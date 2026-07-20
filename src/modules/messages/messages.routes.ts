import { Router, Request, Response, NextFunction } from 'express';
import { authenticate }                               from '../../middleware/auth.middleware';
import {
  uploadPhoto as uploadMiddleware,
  uploadFileToCloud,
}                                                     from '../../middleware/upload.middleware';
import { ok, badRequest, serverError }                from '../../utils/response';

const router = Router();
router.use(authenticate);

// POST /api/messages/upload
// Reçoit une image (multipart/form-data, champ "photo"),
// l'envoie sur Cloudinary et retourne { url }
router.post(
  '/upload',
  (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, message: (err as Error).message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) { badRequest(res, 'Aucun fichier fourni'); return; }
      const url = await uploadFileToCloud(req.file, 'affinity/chat');
      ok(res, { url });
    } catch (err: unknown) {
      serverError(res, err instanceof Error ? err.message : undefined);
    }
  },
);

export default router;
