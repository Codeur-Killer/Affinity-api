import { Router, Request, Response, NextFunction } from 'express';
import { FieldValue }                                from 'firebase-admin/firestore';
import { authenticate }                              from '../../middleware/auth.middleware';
import {
  uploadPhoto as uploadMiddleware,
  uploadFileToCloud,
}                                                    from '../../middleware/upload.middleware';
import { getFirestore }                              from '../../config/firebase';
import { ok, badRequest, serverError }               from '../../utils/response';

const router = Router();
router.use(authenticate);

// ── POST /api/messages/upload ───────────────────────────────────────────────────
// Upload une image pour le chat → Cloudinary → { url }
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

// ── POST /api/messages/:conversationId ─────────────────────────────────────────
// Envoie un message via Admin SDK (ignore les règles Firestore côté client)
router.post('/:conversationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId }              = req.params;
    const { text, type = 'text', mediaUrl } = req.body as {
      text?:      string;
      type?:      string;
      mediaUrl?:  string;
    };

    const senderId = req.user!.id;
    const db       = getFirestore();

    const convRef = db.collection('conversations').doc(conversationId);
    const msgRef  = convRef.collection('messages').doc();

    const msgData: Record<string, unknown> = {
      senderId,
      text:      text ?? '',
      type,
      createdAt: FieldValue.serverTimestamp(),
      readAt:    null,
    };
    if (mediaUrl) msgData['mediaUrl'] = mediaUrl;

    const batch = db.batch();
    batch.set(msgRef, msgData);
    batch.update(convRef, {
      lastMessage: {
        text:      type === 'text' ? (text ?? '') : type === 'gif' ? 'GIF' : 'Photo',
        senderId,
        createdAt: FieldValue.serverTimestamp(),
      },
    });

    await batch.commit();
    ok(res, { messageId: msgRef.id });
  } catch (err: unknown) {
    serverError(res, err instanceof Error ? err.message : undefined);
  }
});

export default router;
